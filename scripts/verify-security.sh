#!/bin/bash

# AI Compliance Shepherd - Security Verification Script (Windows Compatible)
# This script verifies that security fixes are working correctly

echo "🔒 AI Compliance Shepherd - Security Verification"
echo "================================================="

# Colors for output (Windows compatible)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-https://wlx6nzcpqh.execute-api.us-east-1.amazonaws.com/prod}"
DEMO_URL="${DEMO_URL:-https://demo.cloudaimldevops.com}"

echo "Testing API: $API_BASE_URL"
echo "Testing Demo: $DEMO_URL"
echo ""

# Function to make HTTP requests (Windows compatible)
make_request() {
    local method="$1"
    local url="$2"
    local headers="$3"
    local data="$4"
    
    if command -v curl >/dev/null 2>&1; then
        if [ -n "$data" ]; then
            curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "$headers" -d "$data" "$url"
        else
            curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "$headers" "$url"
        fi
    elif command -v powershell >/dev/null 2>&1; then
        # Use PowerShell for Windows
        if [ -n "$data" ]; then
            powershell -Command "try { (Invoke-WebRequest -Uri '$url' -Method '$method' -Headers @{$headers} -Body '$data' -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }"
        else
            powershell -Command "try { (Invoke-WebRequest -Uri '$url' -Method '$method' -Headers @{$headers} -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }"
        fi
    else
        echo "000" # No HTTP client available
    fi
}

# Test 1: Basic API Connectivity
echo "1. Testing API Connectivity..."
echo "------------------------------"

HEALTH_RESPONSE=$(make_request "GET" "$API_BASE_URL/health" "Content-Type: application/json")
echo "Health endpoint response: HTTP $HEALTH_RESPONSE"

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ API Connectivity: WORKING${NC}"
    API_WORKING=true
else
    echo -e "${RED}❌ API Connectivity: FAILED (HTTP $HEALTH_RESPONSE)${NC}"
    echo -e "${YELLOW}⚠️  This may be due to:${NC}"
    echo "   - API Gateway not deployed"
    echo "   - Incorrect API URL"
    echo "   - Network connectivity issues"
    API_WORKING=false
fi

echo ""

# Test 2: CORS Configuration (if API is working)
if [ "$API_WORKING" = true ]; then
    echo "2. Testing CORS Configuration..."
    echo "--------------------------------"

    # Test allowed origin
    echo "Testing allowed origin (should succeed):"
    CORS_RESPONSE=$(make_request "OPTIONS" "$API_BASE_URL/scans" \
        "Origin: https://demo.cloudaimldevops.com" \
        "Access-Control-Request-Method: POST" \
        "Access-Control-Request-Headers: Content-Type")

    if [ "$CORS_RESPONSE" = "200" ]; then
        echo -e "${GREEN}✅ CORS for allowed origin: PASSED${NC}"
    else
        echo -e "${YELLOW}⚠️  CORS for allowed origin: HTTP $CORS_RESPONSE${NC}"
    fi

    # Test blocked origin
    echo "Testing blocked origin (should be blocked or restricted):"
    BLOCKED_CORS_RESPONSE=$(make_request "OPTIONS" "$API_BASE_URL/scans" \
        "Origin: https://malicious-site.com" \
        "Access-Control-Request-Method: POST" \
        "Access-Control-Request-Headers: Content-Type")

    if [ "$BLOCKED_CORS_RESPONSE" = "200" ]; then
        echo -e "${YELLOW}⚠️  CORS for blocked origin: ALLOWED (may need environment variable)${NC}"
    else
        echo -e "${GREEN}✅ CORS for blocked origin: BLOCKED${NC}"
    fi
else
    echo "2. Skipping CORS test (API not accessible)"
fi

echo ""

# Test 3: Rate Limiting (if API is working)
if [ "$API_WORKING" = true ]; then
    echo "3. Testing Rate Limiting..."
    echo "---------------------------"

    echo "Sending 10 requests to test rate limiting..."
    RATE_LIMIT_COUNT=0
    for i in {1..10}; do
        RESPONSE=$(make_request "GET" "$API_BASE_URL/health" "Content-Type: application/json")
        
        if [ "$RESPONSE" = "429" ]; then
            RATE_LIMIT_COUNT=$((RATE_LIMIT_COUNT + 1))
        fi
        
        # Small delay to avoid overwhelming the API
        sleep 0.1
    done

    echo "Rate limit violations detected: $RATE_LIMIT_COUNT"
    if [ "$RATE_LIMIT_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Rate limiting: WORKING${NC}"
    else
        echo -e "${YELLOW}⚠️  Rate limiting: NOT DETECTED (may need deployment)${NC}"
    fi
else
    echo "3. Skipping rate limiting test (API not accessible)"
fi

echo ""

# Test 4: Authentication (if API is working)
if [ "$API_WORKING" = true ]; then
    echo "4. Testing Authentication..."
    echo "----------------------------"

    echo "Testing unauthenticated request (should be rejected):"
    AUTH_RESPONSE=$(make_request "GET" "$API_BASE_URL/scans" "Content-Type: application/json")

    if [ "$AUTH_RESPONSE" = "401" ] || [ "$AUTH_RESPONSE" = "403" ]; then
        echo -e "${GREEN}✅ Authentication: WORKING${NC}"
    else
        echo -e "${YELLOW}⚠️  Authentication: HTTP $AUTH_RESPONSE${NC}"
    fi
else
    echo "4. Skipping authentication test (API not accessible)"
fi

echo ""

# Test 5: Demo Website Accessibility
echo "5. Testing Demo Website..."
echo "--------------------------"

DEMO_RESPONSE=$(make_request "GET" "$DEMO_URL" "User-Agent: Security-Test")
echo "Demo website response: HTTP $DEMO_RESPONSE"

if [ "$DEMO_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Demo Website: ACCESSIBLE${NC}"
else
    echo -e "${YELLOW}⚠️  Demo Website: HTTP $DEMO_RESPONSE${NC}"
fi

echo ""

# Summary
echo "📊 Security Verification Summary"
echo "================================="
echo ""

if [ "$API_WORKING" = true ]; then
    echo -e "${GREEN}🎉 API is accessible and security features can be tested${NC}"
    echo -e "${GREEN}✅ Your application is ready for security configuration${NC}"
else
    echo -e "${YELLOW}⚠️  API is not accessible - security features cannot be tested${NC}"
    echo -e "${YELLOW}📝 This is normal if the API hasn't been deployed yet${NC}"
fi

echo ""
echo "🔧 Next Steps:"
if [ "$API_WORKING" = false ]; then
    echo "1. Deploy your infrastructure: npm run deploy"
    echo "2. Wait for deployment to complete"
    echo "3. Run this script again to verify"
else
    echo "1. Set environment variables in your deployment"
    echo "2. Deploy updated code: npm run deploy"
    echo "3. Run this script again to verify"
fi
echo "4. Monitor security logs for any issues"

echo ""
echo "📚 Documentation:"
echo "- Security fixes: SECURITY_ASSESSMENT_REPORT.md"
echo "- Environment setup: ENVIRONMENT_CONFIGURATION.md"
echo "- Installation: README.md"

echo ""
echo "🔍 Manual Testing Commands:"
echo "Test CORS: curl -H \"Origin: https://demo.cloudaimldevops.com\" -X OPTIONS $API_BASE_URL/scans"
echo "Test Health: curl -X GET $API_BASE_URL/health"
echo "Test Auth: curl -X GET $API_BASE_URL/scans"
