// Test OPTIONS endpoint directly
const https = require('https');

console.log('Testing OPTIONS for remediate endpoint...');
const remediateUrl = 'https://5v2tvgyom0.execute-api.us-east-1.amazonaws.com/prod/remediate';

const optionsReq = https.request(remediateUrl, {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://demo.cloudaimldevops.com'
  }
}, (res) => {
  console.log(`OPTIONS status: ${res.statusCode}`);
  console.log('OPTIONS Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('OPTIONS Response:', data);
  });
});

optionsReq.on('error', (err) => {
  console.error('OPTIONS Error:', err);
});

optionsReq.end();
