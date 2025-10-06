@echo off
REM AI Compliance Shepherd - Installation Script for Windows
REM This script handles workspace dependency issues

echo 🚀 AI Compliance Shepherd Installation Script
echo ==============================================

REM Check Node.js version
for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION%") do set NODE_MAJOR=%%i

if %NODE_MAJOR% LSS 18 (
    echo ❌ Node.js version %NODE_VERSION% detected. Please upgrade to Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js version %NODE_VERSION% detected

REM Check npm version
for /f "tokens=1 delims=." %%i in ('npm --version') do set NPM_MAJOR=%%i

if %NPM_MAJOR% LSS 7 (
    echo ❌ npm version %NPM_MAJOR% detected. Please upgrade to npm 7+
    echo Run: npm install -g npm@latest
    pause
    exit /b 1
)

echo ✅ npm version detected

REM Install root dependencies first
echo 📦 Installing root dependencies...
npm install --no-workspaces

REM Install shared dependencies
echo 📦 Installing shared dependencies...
cd shared
npm install
cd ..

REM Install service dependencies individually
echo 📦 Installing service dependencies...
for /d %%i in (services\*) do (
    echo   Installing %%~ni...
    cd "%%i"
    npm install
    cd ..\..
)

REM Install infrastructure dependencies
echo 📦 Installing infrastructure dependencies...
cd infrastructure\cdk
npm install
cd ..\..

REM Install testing dependencies
echo 📦 Installing testing dependencies...
cd testing
npm install
cd ..

echo ✅ Installation complete!
echo.
echo Next steps:
echo 1. Configure AWS CLI: aws configure
echo 2. Deploy infrastructure: npm run deploy
echo 3. Generate demo data: npm run demo:data
echo 4. Run tests: npm test
echo.
echo 🎉 AI Compliance Shepherd is ready!
pause
