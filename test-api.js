// Simple test script to verify API Gateway is working
const https = require('https');

const apiUrl = 'https://5v2tvgyom0.execute-api.us-east-1.amazonaws.com/prod';

// Test health endpoint
console.log('Testing health endpoint...');
const healthUrl = `${apiUrl}/health`;

const options = {
  method: 'GET',
  headers: {
    'Origin': 'https://demo.cloudaimldevops.com'
  }
};

const req = https.request(healthUrl, options, (res) => {
  console.log(`Health endpoint status: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    
    // Test OPTIONS for remediate endpoint
    console.log('\nTesting OPTIONS for remediate endpoint...');
    const remediateUrl = `${apiUrl}/remediate`;
    
    const optionsReq = https.request(remediateUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://demo.cloudaimldevops.com'
      }
    }, (optionsRes) => {
      console.log(`OPTIONS status: ${optionsRes.statusCode}`);
      console.log('OPTIONS Headers:', optionsRes.headers);
      
      let optionsData = '';
      optionsRes.on('data', (chunk) => {
        optionsData += chunk;
      });
      
      optionsRes.on('end', () => {
        console.log('OPTIONS Response:', optionsData);
      });
    });
    
    optionsReq.on('error', (err) => {
      console.error('OPTIONS Error:', err);
    });
    
    optionsReq.end();
  });
});

req.on('error', (err) => {
  console.error('Health Error:', err);
});

req.end();
