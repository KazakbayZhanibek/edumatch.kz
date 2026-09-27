'use strict';

// A source label alone is not evidence of an official historical observation.
function rejectionReason(row) {
  if (/demo|manual|estimate|generated|synthetic|mock|test/i.test(row.source_label || '')) return 'synthetic';
  if (!String(row.source_label || '').trim()) return 'missing_source';
  try {
    const url = new URL(row.source_url);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.')) return 'missing_source';
  } catch { return 'missing_source'; }
  // Explicit manual verification must be recorded before statistics can be used.
  if (!/^verified:/i.test(row.source_label)) return 'unverified';
  return null;
}

module.exports = { rejectionReason };
