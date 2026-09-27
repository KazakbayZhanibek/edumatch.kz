// Regenerate a length-limited answer with more room. Never join independently
// generated fragments: the cut can occur inside a word or Markdown delimiter.
async function completeAnswer(request, initialTokens = 4096, { expand = true } = {}) {
  let tokens = initialTokens;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await request(tokens);
    if (typeof result.text !== 'string' || !result.text.trim()) {
      throw new Error('AI returned an empty answer');
    }
    if (result.finish_reason !== 'length') {
      if (result.finish_reason && result.finish_reason !== 'stop') {
        throw new Error(`AI completion stopped: ${result.finish_reason}`);
      }
      return { ...result, truncated: false };
    }
    if (!expand || tokens >= 16384 || attempt === 2) {
      return { ...result, truncated: true };
    }
    tokens = Math.min(tokens * 4, 16384);
  }
}

module.exports = { completeAnswer };
