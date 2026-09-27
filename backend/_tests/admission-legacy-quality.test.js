const {test} = require('node:test');
const assert = require('node:assert/strict');

test('legacy prediction exposes catalogue checks without invented probabilities or thresholds', () => {
  const database = require('../database');
  const original = database.getDb;
  const row = {university_id:1,short_name:'University',name:'University',languages:'["русский"]',price_from:2000000,min_ent:50,avg_ent:80,grant_min_ent:100,competition_level:3,has_dorm:1,specialty_name:'IT',academic_year:'2026-2027'};
  database.getDb = () => ({prepare: () => ({all: () => [row]})});
  const filename = require.resolve('../admission-service');
  delete require.cache[filename];
  try {
    const {getAdmissionPrediction} = require('../admission-service');
    for (const ent of [40, 100, 140]) {
      const result = getAdmissionPrediction({ent,specialty:'IT',budget:1000000,language:'русский',needDorm:true});
      const match = result.matches[0];
      assert.equal(match.chance, null);
      assert.equal(match.portfolio, 'needs_review');
      assert.equal(match.requirement.min_ent, null);
      assert.equal(match.requirement.grant_min_ent, null);
      assert.equal(match.score, undefined);
      assert.deepEqual(match.scoreBreakdown, []);
      assert.deepEqual(result.whatIf, []);
      assert.equal(match.checks.find(item=>item.key==='ent').status, 'unknown');
      assert.equal(match.checks.find(item=>item.key==='budget').status, 'outside_catalogue');
      assert.equal(match.checks.find(item=>item.key==='specialty').status, 'catalogue_match');
    }
  } finally { database.getDb=original; delete require.cache[filename]; }
});

test('legacy unknown chance does not produce an AI probability explanation', async () => {
  const {getExplanationForMatch} = require('../admission-explanation-service');
  const result = await getExplanationForMatch([{chance:null}], {lang:'ru'}, true);
  assert.equal(result.strategy, 'insufficient_data');
});
