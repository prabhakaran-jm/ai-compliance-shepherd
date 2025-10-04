#!/usr/bin/env node

/**
 * AI Compliance Shepherd - Real Demo Server
 * Serves the actual demo interface connecting to deployed infrastructure
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3001; // Different port to avoid conflicts
const DEMO_FILE = path.join(__dirname, 'index.html');
const API_BASE = 'https://2d11fsgdw2.execute-api.us-east-1.amazonaws.com/prod';

const server = http.createServer((req, res) => {
    // Handle CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Proxy API requests to avoid CORS issues
    if (req.url.startsWith('/api/proxy/')) {
        const endpoint = req.url.replace('/api/proxy/', '');
        const apiUrl = `${API_BASE}/${endpoint}`;
        
        console.log(`Proxying ${req.method} request to: ${apiUrl}`);
        
        // Parse URL for the request
        const url = new URL(apiUrl);
        
        // Prepare request options
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'AI-Compliance-Demo'
            }
        };
        
        // Handle request body for POST requests
        let requestBody = '';
        if (req.method === 'POST') {
            req.on('data', (chunk) => {
                requestBody += chunk;
            });
        }
        
        // For GET requests, process immediately
        if (req.method === 'GET') {
            processRequest();
        } else {
            req.on('end', () => {
                processRequest();
            });
        }
        
        function processRequest() {
            // Make the actual request
            const proxyReq = https.request(options, (apiRes) => {
                let data = '';
                apiRes.on('data', (chunk) => {
                    data += chunk;
                });
                apiRes.on('end', () => {
                    res.writeHead(apiRes.statusCode, { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(data);
                });
            });
            
            proxyReq.on('error', (error) => {
                console.error('Proxy error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            });
            
            // Write request body for POST requests
            if (req.method === 'POST' && requestBody) {
                proxyReq.write(requestBody);
            }
            
            proxyReq.end();
        }
        
        return;
    }

    // Serve the demo HTML file
    if (req.url === '/' || req.url === '/demo') {
        fs.readFile(DEMO_FILE, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading demo');
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`🚀 AI Compliance Shepherd REAL Demo Server running at:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://localhost:${PORT}/demo`);
    console.log(`\n📋 Connected to LIVE Infrastructure:`);
    console.log(`   ✅ API Gateway: ${API_BASE}/`);
    console.log(`   ✅ Lambda Functions: Deployed and running`);
    console.log(`   ✅ DynamoDB: ai-compliance-demo-findings`);
    console.log(`   ✅ S3 Bucket: 556274720247-ai-compliance-demo-1759570442682`);
    console.log(`   ✅ CloudWatch: AI-Compliance-Demo-Dashboard`);
    console.log(`\n🔧 CORS Proxy: Enabled for API calls`);
    console.log(`\n🎬 Perfect for recording your hackathon demo video!`);
    console.log(`\n💡 This demo connects to your REAL deployed infrastructure, not simulations!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Real demo server shutting down...');
    server.close(() => {
        console.log('✅ Demo server stopped');
        process.exit(0);
    });
});
