#!/bin/bash

# AI Compliance Shepherd - Run All Tests Script
# This script runs the complete test suite including unit, integration, E2E, performance, and security tests

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTING_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$TESTING_DIR")"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="$TESTING_DIR/reports"

# Test configuration
RUN_UNIT_TESTS=true
RUN_INTEGRATION_TESTS=true
RUN_E2E_TESTS=true
RUN_PERFORMANCE_TESTS=false
RUN_SECURITY_TESTS=false
GENERATE_COVERAGE=true
SEND_NOTIFICATIONS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-unit)
      RUN_UNIT_TESTS=false
      shift
      ;;
    --skip-integration)
      RUN_INTEGRATION_TESTS=false
      shift
      ;;
    --skip-e2e)
      RUN_E2E_TESTS=false
      shift
      ;;
    --include-performance)
      RUN_PERFORMANCE_TESTS=true
      shift
      ;;
    --include-security)
      RUN_SECURITY_TESTS=true
      shift
      ;;
    --no-coverage)
      GENERATE_COVERAGE=false
      shift
      ;;
    --send-notifications)
      SEND_NOTIFICATIONS=true
      shift
      ;;
    --help)
      echo "AI Compliance Shepherd Test Runner"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-unit              Skip unit tests"
      echo "  --skip-integration       Skip integration tests"
      echo "  --skip-e2e              Skip end-to-end tests"
      echo "  --include-performance    Include performance tests"
      echo "  --include-security       Include security tests"
      echo "  --no-coverage           Skip coverage generation"
      echo "  --send-notifications    Send test result notifications"
      echo "  --help                  Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                                    # Run unit, integration, and E2E tests"
      echo "  $0 --skip-e2e --include-performance  # Skip E2E, include performance tests"
      echo "  $0 --include-security                # Run all tests including security"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Function to print colored output
print_status() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Function to print section headers
print_header() {
  local message=$1
  echo ""
  echo "================================================="
  echo "$message"
  echo "================================================="
  echo ""
}

# Function to check prerequisites
check_prerequisites() {
  print_header "Checking Prerequisites"
  
  # Check Node.js version
  if ! command -v node &> /dev/null; then
    print_status $RED "❌ Node.js is not installed"
    exit 1
  fi
  
  local node_version=$(node --version | cut -d'v' -f2)
  local required_version="18.0.0"
  
  if ! printf '%s\n%s\n' "$required_version" "$node_version" | sort -V -C; then
    print_status $RED "❌ Node.js version $node_version is less than required $required_version"
    exit 1
  fi
  
  print_status $GREEN "✅ Node.js version $node_version"
  
  # Check npm
  if ! command -v npm &> /dev/null; then
    print_status $RED "❌ npm is not installed"
    exit 1
  fi
  
  print_status $GREEN "✅ npm $(npm --version)"
  
  # Check if in correct directory
  if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    print_status $RED "❌ Not in AI Compliance Shepherd project root"
    exit 1
  fi
  
  print_status $GREEN "✅ Project structure validated"
}

# Function to setup test environment
setup_test_environment() {
  print_header "Setting Up Test Environment"
  
  # Create reports directory
  mkdir -p "$REPORT_DIR/coverage"
  mkdir -p "$REPORT_DIR/junit"
  mkdir -p "$REPORT_DIR/performance"
  mkdir -p "$REPORT_DIR/security"
  
  # Install dependencies if needed
  if [[ ! -d "$TESTING_DIR/node_modules" ]]; then
    print_status $YELLOW "📦 Installing testing dependencies..."
    cd "$TESTING_DIR"
    npm install
  fi
  
  # Install Playwright browsers if E2E tests are enabled
  if [[ "$RUN_E2E_TESTS" == "true" ]]; then
    if [[ ! -d "$TESTING_DIR/e2e-tests/node_modules" ]]; then
      print_status $YELLOW "📦 Installing E2E test dependencies..."
      cd "$TESTING_DIR/e2e-tests"
      npm install
    fi
    
    print_status $YELLOW "🎭 Installing Playwright browsers..."
    npx playwright install --with-deps
  fi
  
  # Set environment variables
  export NODE_ENV=test
  export LOG_LEVEL=error
  export AWS_REGION=us-east-1
  export XRAY_TRACING_ENABLED=false
  
  print_status $GREEN "✅ Test environment setup complete"
}

# Function to run unit tests
run_unit_tests() {
  if [[ "$RUN_UNIT_TESTS" != "true" ]]; then
    print_status $YELLOW "⏭️  Skipping unit tests"
    return 0
  fi
  
  print_header "Running Unit Tests"
  
  cd "$TESTING_DIR/unit-tests"
  
  local test_command="jest"
  if [[ "$GENERATE_COVERAGE" == "true" ]]; then
    test_command="$test_command --coverage"
  fi
  
  if [[ "${CI:-false}" == "true" ]]; then
    test_command="$test_command --ci --watchAll=false"
  fi
  
  if $test_command; then
    print_status $GREEN "✅ Unit tests passed"
    return 0
  else
    print_status $RED "❌ Unit tests failed"
    return 1
  fi
}

# Function to run integration tests
run_integration_tests() {
  if [[ "$RUN_INTEGRATION_TESTS" != "true" ]]; then
    print_status $YELLOW "⏭️  Skipping integration tests"
    return 0
  fi
  
  print_header "Running Integration Tests"
  
  cd "$TESTING_DIR/integration-tests"
  
  # Start LocalStack if needed
  if command -v docker &> /dev/null; then
    print_status $YELLOW "🐳 Starting LocalStack..."
    docker run -d --name ai-compliance-test-localstack \
      -p 4566:4566 \
      -e SERVICES=dynamodb,s3,lambda,cloudwatch,kms,secretsmanager \
      localstack/localstack:latest || true
    
    # Wait for LocalStack to be ready
    sleep 10
  fi
  
  local test_command="jest"
  if [[ "${CI:-false}" == "true" ]]; then
    test_command="$test_command --ci --watchAll=false"
  fi
  
  local result=0
  if $test_command; then
    print_status $GREEN "✅ Integration tests passed"
  else
    print_status $RED "❌ Integration tests failed"
    result=1
  fi
  
  # Cleanup LocalStack
  if command -v docker &> /dev/null; then
    docker stop ai-compliance-test-localstack || true
    docker rm ai-compliance-test-localstack || true
  fi
  
  return $result
}

# Function to run E2E tests
run_e2e_tests() {
  if [[ "$RUN_E2E_TESTS" != "true" ]]; then
    print_status $YELLOW "⏭️  Skipping E2E tests"
    return 0
  fi
  
  print_header "Running End-to-End Tests"
  
  cd "$TESTING_DIR/e2e-tests"
  
  local test_command="npx playwright test"
  if [[ "${CI:-false}" == "true" ]]; then
    test_command="$test_command --reporter=junit"
  fi
  
  if $test_command; then
    print_status $GREEN "✅ E2E tests passed"
    return 0
  else
    print_status $RED "❌ E2E tests failed"
    return 1
  fi
}

# Function to run performance tests
run_performance_tests() {
  if [[ "$RUN_PERFORMANCE_TESTS" != "true" ]]; then
    print_status $YELLOW "⏭️  Skipping performance tests"
    return 0
  fi
  
  print_header "Running Performance Tests"
  
  cd "$TESTING_DIR/performance-tests"
  
  if npx artillery run artillery.yml --output "$REPORT_DIR/performance/performance-report-$TIMESTAMP.json"; then
    print_status $GREEN "✅ Performance tests completed"
    
    # Generate HTML report
    npx artillery report "$REPORT_DIR/performance/performance-report-$TIMESTAMP.json" \
      --output "$REPORT_DIR/performance/performance-report-$TIMESTAMP.html"
    
    return 0
  else
    print_status $RED "❌ Performance tests failed"
    return 1
  fi
}

# Function to run security tests
run_security_tests() {
  if [[ "$RUN_SECURITY_TESTS" != "true" ]]; then
    print_status $YELLOW "⏭️  Skipping security tests"
    return 0
  fi
  
  print_header "Running Security Tests"
  
  local security_passed=true
  
  # Run dependency vulnerability scan
  print_status $BLUE "🔍 Running dependency vulnerability scan..."
  if command -v snyk &> /dev/null; then
    if snyk test --json > "$REPORT_DIR/security/snyk-report-$TIMESTAMP.json"; then
      print_status $GREEN "✅ No high-severity vulnerabilities found"
    else
      print_status $RED "❌ Security vulnerabilities detected"
      security_passed=false
    fi
  else
    print_status $YELLOW "⚠️  Snyk not installed, skipping vulnerability scan"
  fi
  
  # Run static code analysis
  print_status $BLUE "🔍 Running static code analysis..."
  if command -v semgrep &> /dev/null; then
    if semgrep --config=auto "$PROJECT_ROOT" --json > "$REPORT_DIR/security/semgrep-report-$TIMESTAMP.json"; then
      print_status $GREEN "✅ Static analysis passed"
    else
      print_status $RED "❌ Static analysis found issues"
      security_passed=false
    fi
  else
    print_status $YELLOW "⚠️  Semgrep not installed, skipping static analysis"
  fi
  
  if [[ "$security_passed" == "true" ]]; then
    print_status $GREEN "✅ Security tests passed"
    return 0
  else
    print_status $RED "❌ Security tests failed"
    return 1
  fi
}

# Function to generate merged coverage report
generate_coverage_report() {
  if [[ "$GENERATE_COVERAGE" != "true" ]]; then
    return 0
  fi
  
  print_header "Generating Coverage Report"
  
  cd "$TESTING_DIR"
  
  # Merge coverage reports if multiple exist
  local coverage_files=()
  if [[ -f "unit-tests/coverage/coverage-final.json" ]]; then
    coverage_files+=("unit-tests/coverage/coverage-final.json")
  fi
  if [[ -f "integration-tests/coverage/coverage-final.json" ]]; then
    coverage_files+=("integration-tests/coverage/coverage-final.json")
  fi
  
  if [[ ${#coverage_files[@]} -gt 1 ]]; then
    npx istanbul-merge --out "reports/coverage/merged-coverage.json" "${coverage_files[@]}"
    npx istanbul report --include "reports/coverage/merged-coverage.json" html
    print_status $GREEN "✅ Merged coverage report generated"
  elif [[ ${#coverage_files[@]} -eq 1 ]]; then
    cp "${coverage_files[0]}" "reports/coverage/merged-coverage.json"
    print_status $GREEN "✅ Coverage report copied"
  else
    print_status $YELLOW "⚠️  No coverage data found"
  fi
}

# Function to send notifications
send_notifications() {
  if [[ "$SEND_NOTIFICATIONS" != "true" ]]; then
    return 0
  fi
  
  print_header "Sending Notifications"
  
  local status="✅ PASSED"
  local color=$GREEN
  
  if [[ $OVERALL_RESULT -ne 0 ]]; then
    status="❌ FAILED"
    color=$RED
  fi
  
  local message="AI Compliance Shepherd Test Run $status"
  local details="Timestamp: $TIMESTAMP\nResults available in: $REPORT_DIR"
  
  print_status $color "$message"
  print_status $BLUE "$details"
  
  # Add webhook notification here if needed
  # curl -X POST "$SLACK_WEBHOOK_URL" -H 'Content-type: application/json' --data "{\"text\":\"$message\n$details\"}"
}

# Function to cleanup
cleanup() {
  print_header "Cleaning Up"
  
  # Stop any running test services
  if command -v docker &> /dev/null; then
    docker stop ai-compliance-test-localstack 2>/dev/null || true
    docker rm ai-compliance-test-localstack 2>/dev/null || true
  fi
  
  # Clean up temporary files
  find "$TESTING_DIR" -name "*.tmp" -delete 2>/dev/null || true
  
  print_status $GREEN "✅ Cleanup complete"
}

# Main execution
main() {
  local start_time=$(date +%s)
  
  print_header "AI Compliance Shepherd - Test Suite Runner"
  print_status $BLUE "Starting test execution at $(date)"
  
  # Check prerequisites
  check_prerequisites
  
  # Setup test environment
  setup_test_environment
  
  # Track overall result
  OVERALL_RESULT=0
  
  # Run test suites
  if ! run_unit_tests; then
    OVERALL_RESULT=1
  fi
  
  if ! run_integration_tests; then
    OVERALL_RESULT=1
  fi
  
  if ! run_e2e_tests; then
    OVERALL_RESULT=1
  fi
  
  if ! run_performance_tests; then
    OVERALL_RESULT=1
  fi
  
  if ! run_security_tests; then
    OVERALL_RESULT=1
  fi
  
  # Generate coverage report
  generate_coverage_report
  
  # Send notifications
  send_notifications
  
  # Cleanup
  cleanup
  
  # Final summary
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  print_header "Test Execution Summary"
  print_status $BLUE "Execution time: ${duration}s"
  print_status $BLUE "Reports directory: $REPORT_DIR"
  
  if [[ $OVERALL_RESULT -eq 0 ]]; then
    print_status $GREEN "🎉 All tests passed successfully!"
  else
    print_status $RED "💥 Some tests failed. Check the reports for details."
  fi
  
  exit $OVERALL_RESULT
}

# Set up trap for cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"
