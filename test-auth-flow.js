#!/usr/bin/env node
/**
 * test-auth-flow.js
 * Простой тест аутентификации: регистрация -> логин -> верификация -> логаут
 */

const http = require('http');
const querystring = require('querystring');

const API = 'http://localhost:3000/api';

let cookies = {};

function storeCookie(setCookieHeader) {
  if (!setCookieHeader) return;
  
  // Формат: "name=value; Path=/; HttpOnly; SameSite=Lax; ..."
  const parts = setCookieHeader.split(';');
  if (parts.length > 0) {
    const [name, value] = parts[0].split('=');
    if (name && value) {
      cookies[name.trim()] = value.trim();
      console.log('   📌 Stored cookie:', name.trim());
    }
  }
}

function getCookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Добавляем cookies
    const cookieHeader = getCookieHeader();
    if (cookieHeader) {
      options.headers['Cookie'] = cookieHeader;
    }

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';

      // Сохраняем Set-Cookie header
      if (res.headers['set-cookie']) {
        res.headers['set-cookie'].forEach(setCookie => {
          storeCookie(setCookie);
        });
      }

      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    // Debug: показываем что отправляем
    if (options.headers['Cookie']) {
      console.log('   📤 Sending cookies:', options.headers['Cookie']);
    }

    req.end();
  });
}

async function runTests() {
  console.log('🔐 TEST: Authentication Flow\n');

  try {
    // 1. Регистрация
    console.log('1️⃣  Registering new user...');
    const email = `test${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    
    const registerRes = await request('POST', '/auth/register', {
      email,
      password,
      username: `user${Date.now().toString().slice(-5)}`,
      fullName: 'Test User'
    });

    if (registerRes.status !== 201) {
      console.error('❌ Registration failed:', registerRes.data);
      return;
    }

    console.log('✅ Registered successfully');
    console.log('   Email:', email);
    console.log('   User:', registerRes.data.user);
    console.log('   Cookies:', cookies, '\n');

    // 2. Проверка что cookie установлена
    if (!cookies.auth_token) {
      console.warn('⚠️  Warning: auth_token cookie not found after registration');
    } else {
      console.log('✅ auth_token cookie received\n');
    }

    // 3. Верификация сессии
    console.log('2️⃣  Verifying session...');
    const verifyRes = await request('POST', '/auth/verify', {});

    if (verifyRes.status === 401) {
      console.error('❌ Session verification failed:', verifyRes.data);
      console.error('   This means cookies are not being sent properly');
      return;
    }

    if (verifyRes.status !== 200) {
      console.error('❌ Verification failed:', verifyRes.data);
      return;
    }

    console.log('✅ Session verified');
    console.log('   User:', verifyRes.data.user, '\n');

    // 4. Логаут
    console.log('3️⃣  Logging out...');
    const logoutRes = await request('POST', '/auth/logout', {});

    if (logoutRes.status !== 200) {
      console.error('❌ Logout failed:', logoutRes.data);
      return;
    }

    console.log('✅ Logged out successfully\n');

    // 5. Проверка что после логаута не можно верифицировать
    console.log('4️⃣  Trying to verify after logout (should fail)...');
    const verifyAfterLogoutRes = await request('POST', '/auth/verify', {});

    if (verifyAfterLogoutRes.status === 401) {
      console.log('✅ Correctly denied access after logout\n');
    } else {
      console.error('❌ Should have been denied access after logout');
      return;
    }

    console.log('🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

console.log('⏳ Waiting for server to be ready...\n');
setTimeout(runTests, 1000);
