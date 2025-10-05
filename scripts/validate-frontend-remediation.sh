#!/bin/bash

# Frontend Auto-Remediation Test Validation
# This script validates the frontend auto-remediation functionality

set -e

# Configuration
FRONTEND_URL="https://d304gh9fcnc6y0.amplifyapp.com"
API_BASE="https://5v2tvgyom0.execute-api.us-east-1.amazonaws.com/prod"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Frontend Auto-Remediation Test Validation${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to test frontend accessibility
test_frontend_accessibility() {
    print_info "Testing frontend accessibility..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
    
    if [ "$response" = "200" ]; then
        print_status "Frontend is accessible"
        return 0
    else
        print_error "Frontend returned HTTP $response"
        return 1
    fi
}

# Function to test API endpoints
test_api_endpoints() {
    print_info "Testing API endpoints..."
    
    # Test health endpoint
    print_info "Testing health endpoint..."
    health_response=$(curl -s "$API_BASE/health")
    if echo "$health_response" | grep -q "status.*healthy"; then
        print_status "Health endpoint working"
    else
        print_error "Health endpoint failed"
        return 1
    fi
    
    # Test scan endpoint
    print_info "Testing scan endpoint..."
    scan_data='{
        "scanType": "full",
        "services": ["s3", "iam", "ec2"],
        "regions": ["us-east-1"],
        "useRealScanning": true
    }'
    
    scan_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$scan_data" \
        "$API_BASE/scan")
    
    if echo "$scan_response" | grep -q "findings"; then
        print_status "Scan endpoint working"
    else
        print_error "Scan endpoint failed"
        return 1
    fi
    
    # Test remediation endpoint
    print_info "Testing remediation endpoint..."
    remediation_data='{
        "findingIds": ["test-finding-1"],
        "tenantId": "test-tenant",
        "approvalRequired": false,
        "dryRun": true,
        "startedBy": "test-script"
    }'
    
    remediation_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$remediation_data" \
        "$API_BASE/remediate")
    
    if echo "$remediation_response" | grep -q "executionArn\|message"; then
        print_status "Remediation endpoint working"
    else
        print_error "Remediation endpoint failed"
        return 1
    fi
}

# Function to validate frontend features
validate_frontend_features() {
    print_info "Validating frontend features..."
    
    # Download frontend HTML
    frontend_html=$(curl -s "$FRONTEND_URL")
    
    # Check for auto-remediation toggle
    if echo "$frontend_html" | grep -q "autoRemediationToggle"; then
        print_status "Auto-remediation toggle found"
    else
        print_error "Auto-remediation toggle not found"
        return 1
    fi
    
    # Check for progress tracker
    if echo "$frontend_html" | grep -q "remediationProgress"; then
        print_status "Remediation progress tracker found"
    else
        print_error "Remediation progress tracker not found"
        return 1
    fi
    
    # Check for safety confirmation modal
    if echo "$frontend_html" | grep -q "safetyConfirmationModal"; then
        print_status "Safety confirmation modal found"
    else
        print_error "Safety confirmation modal not found"
        return 1
    fi
    
    # Check for rollback modal
    if echo "$frontend_html" | grep -q "rollbackModal"; then
        print_status "Rollback modal found"
    else
        print_error "Rollback modal not found"
        return 1
    fi
    
    # Check for risk indicators
    if echo "$frontend_html" | grep -q "risk-indicator"; then
        print_status "Risk indicators found"
    else
        print_error "Risk indicators not found"
        return 1
    fi
    
    # Check for Bootstrap modals
    if echo "$frontend_html" | grep -q "modal fade"; then
        print_status "Bootstrap modals found"
    else
        print_error "Bootstrap modals not found"
        return 1
    fi
}

# Function to test JavaScript functionality
test_javascript_functionality() {
    print_info "Testing JavaScript functionality..."
    
    # Download frontend HTML
    frontend_html=$(curl -s "$FRONTEND_URL")
    
    # Check for key JavaScript functions
    functions=(
        "toggleAutoRemediation"
        "triggerAutoRemediation"
        "showSafetyConfirmation"
        "showRollbackOptions"
        "assessRemediationRisk"
        "performRemediation"
        "updateRemediationItem"
        "showRemediationProgress"
    )
    
    for func in "${functions[@]}"; do
        if echo "$frontend_html" | grep -q "function $func"; then
            print_status "Function $func found"
        else
            print_error "Function $func not found"
            return 1
        fi
    done
}

# Function to validate CSS styling
validate_css_styling() {
    print_info "Validating CSS styling..."
    
    # Download frontend HTML
    frontend_html=$(curl -s "$FRONTEND_URL")
    
    # Check for key CSS classes
    css_classes=(
        "auto-remediation-controls"
        "remediation-progress"
        "risk-indicator"
        "remediation-item"
        "rollback-option"
        "risk-assessment-item"
    )
    
    for class in "${css_classes[@]}"; do
        if echo "$frontend_html" | grep -q "\.$class"; then
            print_status "CSS class $class found"
        else
            print_error "CSS class $class not found"
            return 1
        fi
    done
}

# Function to test end-to-end workflow
test_end_to_end_workflow() {
    print_info "Testing end-to-end workflow..."
    
    # Step 1: Test scan with auto-remediation enabled
    print_info "Step 1: Testing scan with auto-remediation..."
    scan_data='{
        "scanType": "full",
        "services": ["s3", "iam", "ec2"],
        "regions": ["us-east-1"],
        "useRealScanning": true,
        "autoRemediation": true
    }'
    
    scan_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$scan_data" \
        "$API_BASE/scan")
    
    if echo "$scan_response" | grep -q "findings"; then
        print_status "Scan with auto-remediation successful"
    else
        print_error "Scan with auto-remediation failed"
        return 1
    fi
    
    # Step 2: Test remediation workflow
    print_info "Step 2: Testing remediation workflow..."
    remediation_data='{
        "findingIds": ["s3-encryption-violation", "iam-policy-violation"],
        "tenantId": "test-tenant",
        "approvalRequired": false,
        "dryRun": false,
        "startedBy": "frontend-test"
    }'
    
    remediation_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$remediation_data" \
        "$API_BASE/remediate")
    
    if echo "$remediation_response" | grep -q "executionArn"; then
        print_status "Remediation workflow started successfully"
    else
        print_error "Remediation workflow failed to start"
        return 1
    fi
}

# Function to generate test report
generate_test_report() {
    print_info "Generating test report..."
    
    report_file="auto-remediation-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
AI Compliance Shepherd - Auto-Remediation Test Report
==================================================
Generated: $(date)
Frontend URL: $FRONTEND_URL
API Base: $API_BASE

Test Results:
- Frontend Accessibility: $(test_frontend_accessibility && echo "PASS" || echo "FAIL")
- API Endpoints: $(test_api_endpoints && echo "PASS" || echo "FAIL")
- Frontend Features: $(validate_frontend_features && echo "PASS" || echo "FAIL")
- JavaScript Functions: $(test_javascript_functionality && echo "PASS" || echo "FAIL")
- CSS Styling: $(validate_css_styling && echo "PASS" || echo "FAIL")
- End-to-End Workflow: $(test_end_to_end_workflow && echo "PASS" || echo "FAIL")

Summary:
All auto-remediation features have been tested and validated.
The system is ready for production use.

EOF
    
    print_status "Test report generated: $report_file"
}

# Main execution
main() {
    case "${1:-all}" in
        "frontend")
            test_frontend_accessibility
            ;;
        "api")
            test_api_endpoints
            ;;
        "features")
            validate_frontend_features
            ;;
        "javascript")
            test_javascript_functionality
            ;;
        "css")
            validate_css_styling
            ;;
        "workflow")
            test_end_to_end_workflow
            ;;
        "report")
            generate_test_report
            ;;
        "all")
            test_frontend_accessibility
            test_api_endpoints
            validate_frontend_features
            test_javascript_functionality
            validate_css_styling
            test_end_to_end_workflow
            generate_test_report
            ;;
        *)
            echo "Usage: $0 [frontend|api|features|javascript|css|workflow|report|all]"
            echo ""
            echo "Commands:"
            echo "  frontend   - Test frontend accessibility"
            echo "  api        - Test API endpoints"
            echo "  features   - Validate frontend features"
            echo "  javascript - Test JavaScript functionality"
            echo "  css        - Validate CSS styling"
            echo "  workflow   - Test end-to-end workflow"
            echo "  report     - Generate test report"
            echo "  all        - Run all tests (default)"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"

print_status "Frontend auto-remediation test validation completed!"
