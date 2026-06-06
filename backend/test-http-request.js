#!/usr/bin/env node

const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'],
          data: data.substring(0, 500),
          length: data.length
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test() {
  console.log('Testing /api/test-specialties...\n');
  
  const result = await makeRequest('/api/test-specialties');
  console.log('Status:', result.status);
  console.log('Content-Type:', result.contentType);
  console.log('Response length:', result.length);
  console.log('First 500 chars:', result.data);
}

test().catch(console.error);
