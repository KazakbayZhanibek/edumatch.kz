const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completeAnswer } = require('../ai-completion');

test('complete response is returned without extra calls or text clipping', async () => {
  const text = 'Полный ответ. '.repeat(2000);
  let calls = 0;
  const result = await completeAnswer(async tokens => {
    calls++;
    assert.equal(tokens, 4096);
    return { text, finish_reason: 'stop' };
  });
  assert.equal(result.text, text);
  assert.equal(result.truncated, false);
  assert.equal(calls, 1);
});

test('length stop regenerates the whole answer with a larger budget', async () => {
  const budgets = [];
  const result = await completeAnswer(async tokens => {
    budgets.push(tokens);
    return tokens === 1024
      ? { text: '8. КазНУ: **Сто', finish_reason: 'length' }
      : { text: '8. КазНУ: **Стоимость обучения:** уточняйте в вузе.\n\nКонец ответа.', finish_reason: 'stop' };
  }, 1024);
  assert.deepEqual(budgets, [1024, 4096]);
  assert.equal(result.truncated, false);
  assert.equal(result.text.match(/КазНУ/g).length, 1);
  assert.ok(result.text.endsWith('Конец ответа.'));
});

test('repeated truncation is bounded and explicitly reported', async () => {
  const budgets = [];
  const result = await completeAnswer(async tokens => {
    budgets.push(tokens);
    return { text: 'Незавершённый ответ', finish_reason: 'length' };
  }, 1024);
  assert.deepEqual(budgets, [1024, 4096, 16384]);
  assert.equal(result.truncated, true);
});

test('short classifier limits are not expanded', async () => {
  let calls = 0;
  const result = await completeAnswer(async () => {
    calls++;
    return { text: '{"intent":', finish_reason: 'length' };
  }, 150, { expand: false });
  assert.equal(result.truncated, true);
  assert.equal(calls, 1);
});

test('empty provider responses are not treated as complete answers', async () => {
  await assert.rejects(completeAnswer(async () => ({ text: '', finish_reason: 'stop' })), /empty answer/);
});

test('provider error and filter stops do not trigger regeneration', async () => {
  for (const finish_reason of ['content_filter', 'error', 'tool_calls']) {
    let calls = 0;
    await assert.rejects(completeAnswer(async () => {
      calls++;
      return { text: 'partial', finish_reason };
    }), /completion stopped/);
    assert.equal(calls, 1);
  }
});

test('failed regeneration does not silently return an incomplete answer', async () => {
  let calls = 0;
  await assert.rejects(completeAnswer(async () => {
    if (++calls === 1) return { text: 'partial', finish_reason: 'length' };
    throw new Error('provider unavailable');
  }), /provider unavailable/);
});
