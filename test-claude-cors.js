// Test Claude's CORS fix
const https = require('https');

console.log('Testing Claude\'s CORS fix for OPTIONS endpoint...');
const remediateUrl = 'https://5v2tvgyom0.execute-api.us-east-1.amazonaws.com/prod/remediate';

const optionsReq = https.request(remediateUrl, {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://demo.cloudaimldevops.com',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type'
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
    
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS: OPTIONS request returned 200 with CORS headers!');
    } else {
      console.log('❌ FAILED: OPTIONS request did not return 200');
    }
  });
});

optionsReq.on('error', (err) => {
  console.error('OPTIONS Error:', err);
});

optionsReq.end();
