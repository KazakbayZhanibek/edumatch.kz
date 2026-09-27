const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rejectionReason } = require('../admission-stat-quality');

test('generated statistics cannot become historical evidence even with a URL', () => {
  for (const source_label of ['generated_2026-2027', 'demo/manual estimate', 'verified: synthetic data']) {
    assert.equal(rejectionReason({source_label, source_url:'https://example.edu/report'}), 'synthetic');
  }
});
test('a source URL alone does not establish verification', () => {
  assert.equal(rejectionReason({source_label:'report',source_url:'https://example.edu/report'}), 'unverified');
  assert.equal(rejectionReason({source_label:'verified: report',source_url:null}), 'missing_source');
  assert.equal(rejectionReason({source_label:'verified: report',source_url:'javascript:alert(1)'}), 'missing_source');
  assert.equal(rejectionReason({source_label:'verified: report',source_url:'https://example.edu/report'}), null);
});
test('calculator excludes generated rows and returns no probability instead of a formula fallback', () => {
  const database = require('../database');
  const original = database.getDb;
  database.getDb = () => ({prepare: sql => ({all: () => sql.includes('admission_chance_stats')
    ? [{source_label:'generated_2026-2027',chance_percent:95}]
    : [{id:1,name:'University',city_name:'City',specialty_name:'IT',price_from:1000000,has_dorm:1,languages:'ru'}]})});
  const filename = require.resolve('../admission-calculator');
  delete require.cache[filename];
  try {
    const calculator = require('../admission-calculator');
    assert.deepEqual(calculator.findHistoricalStats({entScore:100,specialtyId:1}), []);
    const result = calculator.calculateAdmissionChance({entScore:100,specialtyId:1});
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].chancePercent, null);
    assert.equal(result.matches[0].historicalStatsUsed, false);
    assert.equal(result.summary.bestChance, null);
    assert.match(result.matches[0].reasoning[0], /Недостаточно/);
  } finally { database.getDb = original; delete require.cache[filename]; }
});
test('missing probability produces an honest explanation without an AI request', async () => {
  const {getExplanationForMatch} = require('../admission-explanation-service');
  const result = await getExplanationForMatch([{chancePercent:null}], {lang:'ru'}, true);
  assert.equal(result.strategy, 'insufficient_data');
  assert.equal(result.fallback, true);
});
