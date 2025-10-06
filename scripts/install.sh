#!/bin/bash

# AI Compliance Shepherd - Installation Script
# This script handles workspace dependency issues

echo "🚀 AI Compliance Shepherd Installation Script"
echo "=============================================="

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION detected. Please upgrade to Node.js 18+ from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js version $(node --version) detected"

# Check npm version
NPM_VERSION=$(npm --version | cut -d'.' -f1)
if [ "$NPM_VERSION" -lt 7 ]; then
    echo "❌ npm version $NPM_VERSION detected. Please upgrade to npm 7+"
    echo "Run: npm install -g npm@latest"
    exit 1
fi

echo "✅ npm version $(npm --version) detected"

# Install root dependencies first
echo "📦 Installing root dependencies..."
npm install --no-workspaces

# Install shared dependencies
echo "📦 Installing shared dependencies..."
cd shared
npm install
cd ..

# Install service dependencies individually
echo "📦 Installing service dependencies..."
for dir in services/*/; do
    if [ -d "$dir" ]; then
        echo "  Installing $(basename "$dir")..."
        cd "$dir"
        npm install
        cd ../..
    fi
done

# Install infrastructure dependencies
echo "📦 Installing infrastructure dependencies..."
cd infrastructure/cdk
npm install
cd ../..

# Install testing dependencies
echo "📦 Installing testing dependencies..."
cd testing
npm install
cd ..

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Configure AWS CLI: aws configure"
echo "2. Deploy infrastructure: npm run deploy"
echo "3. Generate demo data: npm run demo:data"
echo "4. Run tests: npm test"
echo ""
echo "🎉 AI Compliance Shepherd is ready!"
