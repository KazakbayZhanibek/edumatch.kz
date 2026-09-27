// Comprehensive DB and AI function validation

const Database = require('better-sqlite3');
const { getAIAdvice, retrieveRelevantUniversities } = require('../ai-service');
require('dotenv').config();

const db = new Database('edumatch.db');

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 DATABASE & AI FUNCTION VALIDATION REPORT');
console.log('═══════════════════════════════════════════════════════════════\n');

// ============ 1. DATABASE STRUCTURE CHECK ============
console.log('1️⃣ DATABASE STRUCTURE\n');

// Universities table
const uni_fields = db.pragma('table_info(universities)').map(c => c.name);
console.log('✓ Universities fields:', uni_fields.length);
const required_uni_fields = ['id', 'name', 'short_name', 'price_from', 'price_to', 'languages', 'website'];
const missing_uni = required_uni_fields.filter(f => !uni_fields.includes(f));
if (missing_uni.length > 0) {
  console.log('❌ MISSING FIELDS in universities:', missing_uni.join(', '));
} else {
  console.log('✓ All required university fields present');
}

// Specialties table
const spec_count = db.prepare('SELECT COUNT(*) as cnt FROM specialties').get().cnt;
console.log('✓ Specialties count:', spec_count);

// ============ 2. DATA QUALITY CHECK ============
console.log('\n2️⃣ DATA QUALITY\n');

// Check website field
const website_stats = db.prepare(`
  SELECT 
    SUM(CASE WHEN website LIKE 'http%' THEN 1 ELSE 0 END) as urls,
    SUM(CASE WHEN website LIKE 'проспект%' OR website LIKE 'ул%' THEN 1 ELSE 0 END) as addresses,
    SUM(CASE WHEN website IS NULL THEN 1 ELSE 0 END) as nulls,
    COUNT(*) as total
  FROM universities
`).get();

console.log('Website field analysis:');
console.log('  ✓ Valid URLs:', website_stats.urls);
console.log('  ❌ Physical addresses (should be URLs):', website_stats.addresses);
console.log('  ⚠️ NULL values:', website_stats.nulls);
console.log('  Total universities:', website_stats.total);

// Check price fields
const price_check = db.prepare(`
  SELECT 
    COUNT(*) as total_unis,
    SUM(CASE WHEN price_from > 0 AND price_to > 0 THEN 1 ELSE 0 END) as valid_prices,
    SUM(CASE WHEN price_from IS NULL OR price_to IS NULL THEN 1 ELSE 0 END) as null_prices,
    SUM(CASE WHEN price_from > price_to THEN 1 ELSE 0 END) as invalid_range
  FROM universities
`).get();

console.log('\nPrice fields analysis:');
console.log('  ✓ Valid price ranges:', price_check.valid_prices);
console.log('  ❌ NULL prices:', price_check.null_prices);
console.log('  ❌ Invalid range (price_from > price_to):', price_check.invalid_range);

// Check languages field (JSON)
const langs_sample = db.prepare('SELECT id, name, languages FROM universities LIMIT 1').get();
console.log('\nLanguages field (JSON check):');
try {
  const langs = JSON.parse(langs_sample.languages);
  console.log('  ✓ Valid JSON:', Array.isArray(langs) ? 'array' : typeof langs);
} catch (e) {
  console.log('  ❌ Invalid JSON format:', e.message);
}

// ============ 3. ENVIRONMENT VARIABLES CHECK ============
console.log('\n3️⃣ ENVIRONMENT VARIABLES\n');

const required_env = ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_BASE_URL'];
const missing_env = required_env.filter(key => !process.env[key]);

required_env.forEach(key => {
  if (process.env[key]) {
    const val = process.env[key];
    if (key === 'OPENROUTER_API_KEY') {
      console.log(`✓ ${key}: ${val.substring(0, 10)}...${val.substring(val.length - 5)}`);
    } else {
      console.log(`✓ ${key}: ${val}`);
    }
  } else {
    console.log(`❌ ${key}: NOT SET`);
  }
});

if (missing_env.length === 0) {
  console.log('\n✓ All environment variables configured');
} else {
  console.log(`\n❌ Missing env vars: ${missing_env.join(', ')}`);
}

// ============ 4. AI RETRIEVAL FUNCTION CHECK ============
console.log('\n4️⃣ AI RETRIEVAL FUNCTION TEST\n');

try {
  // Test with sample query
  const query = 'Мне нужны IT специальности, бюджет 1.5 миллион, с общежитием';
  console.log(`Test query: "${query}"`);
  
  const result = retrieveRelevantUniversities(query);
  console.log('\nRetrieved universities:', result.universities.length);
  console.log('Extracted params:', JSON.stringify(result.extractedParams, null, 2));
  
  if (result.universities.length > 0) {
    console.log('\n✓ Sample returned university:');
    const u = result.universities[0];
    console.log(`  - Name: ${u.name}`);
    console.log(`  - Price: ${u.price_from}-${u.price_to} тг`);
    console.log(`  - Website: ${u.website}`);
    console.log(`  - Languages: ${JSON.stringify(u.languages)}`);
    console.log(`  - Specialties: ${u.specialties.length} items`);
  }
} catch (err) {
  console.log('❌ Error in retrieval function:', err.message);
}

// ============ 5. FIELD NAME CONSISTENCY CHECK ============
console.log('\n5️⃣ FIELD NAME CONSISTENCY\n');

const field_issues = [];

// Check if ai-service.js uses correct field names
const ai_service_code = require('fs').readFileSync('../ai-service.js', 'utf8');

// Fields used in AI service
const fields_to_check = ['avg_salary', 'dorm_price', 'has_dorm', 'specialties', 'accreditations'];
fields_to_check.forEach(field => {
  if (ai_service_code.includes(`u.${field}`) || ai_service_code.includes(`.${field}`)) {
    // Check if field exists in DB
    if (!uni_fields.includes(field) && field !== 'specialties') {
      field_issues.push(`Field '${field}' used in AI service but not in DB schema`);
    }
  }
});

if (field_issues.length === 0) {
  console.log('✓ All fields used in AI service exist in DB');
} else {
  field_issues.forEach(issue => console.log('❌', issue));
}

// ============ SUMMARY ============
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📊 SUMMARY\n');

const issues = [
  website_stats.addresses > 0 ? '❌ website field contains addresses instead of URLs' : null,
  missing_env.length > 0 ? `❌ Missing environment variables: ${missing_env.join(', ')}` : null,
  price_check.invalid_range > 0 ? '❌ Some universities have invalid price ranges' : null
].filter(Boolean);

if (issues.length === 0) {
  console.log('✅ All checks passed!');
} else {
  console.log('Found issues:');
  issues.forEach(issue => console.log('  ' + issue));
}

console.log('\n═══════════════════════════════════════════════════════════════');

db.close();
