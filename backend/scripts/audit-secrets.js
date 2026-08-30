const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('FAIL: backend/.env is missing. Copy backend/.env.example first.');
  process.exit(1);
}

const values = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) values[match[1]] = match[2].trim();
}

const failures = [];
const jwt = values.JWT_SECRET || '';
const apiKey = values.OPENROUTER_API_KEY || '';

if (jwt.length < 32 || /change-in-production|replace-with|your-super-secret/i.test(jwt)) {
  failures.push('JWT_SECRET is missing, weak, or still a placeholder');
}
if (/^sk-or-v1-/.test(apiKey) && apiKey.length < 40) {
  failures.push('OPENROUTER_API_KEY looks truncated');
}
if (/your-|replace-with|change-me/i.test(apiKey)) {
  failures.push('OPENROUTER_API_KEY is still a placeholder');
}
if (values.NODE_ENV === 'production' && !values.ALLOWED_ORIGINS) {
  failures.push('ALLOWED_ORIGINS is required in production');
}

if (failures.length) {
  console.error('Secret audit failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Secret audit passed. Values were not printed.');
