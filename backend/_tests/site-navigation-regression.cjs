const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../frontend/js/app.js'), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function router() {
  const pages = Object.fromEntries(['home', 'planner', 'advisor', '404', 'university'].map(page => [page, { classList: { add() {}, remove() {} } }]));
  const pushed = [], replaced = [], modes = {};
  let backs = 0;
  const context = {
    state: { currentPage: 'home', currentParam: null, historyIndex: 0, universities: [1] },
    history: { pushState: (...args) => pushed.push(args), replaceState: (...args) => replaced.push(args), back: () => backs++ },
    document: {
      getElementById: id => id === 'global-back-button' ? { classList: { toggle() {} } } : pages[id.replace('page-', '')],
      querySelectorAll: () => Object.values(pages),
      body: { classList: { toggle: (name, enabled) => { modes[name] = enabled; } } }
    },
    window: { matchMedia: () => ({ matches: false }), scrollTo() {}, dispatchEvent() {} },
    Event: class {}, activateNavLink() {}, updateStickyCompare() {}, hydrateAdvisorChatHistory() {}, loadUniversityDetail() {}
  };
  vm.createContext(context);
  vm.runInContext(['updateBackButton', 'navigateBack', 'updateResponsiveShell', 'navigate'].map(fn).join('\n'), context);
  return { context, pushed, replaced, pages, modes, get backs() { return backs; } };
}
test('same route and normalized university ID do not duplicate history', () => {
  const r = router();
  r.context.navigate('planner');
  r.context.navigate('planner');
  r.context.navigate('university', 12);
  r.context.navigate('university', '12');
  assert.equal(r.pushed.length, 2);
  assert.equal(r.context.state.historyIndex, 2);
});
test('unknown route and malformed university route activate the 404 view', () => {
  const r = router();let activated = 0;
  r.pages['404'].classList.add = () => activated++;
  r.context.navigate('missing');
  r.context.navigate('university', 'invalid', false);
  assert.equal(activated, 2);
  assert.equal(r.context.state.currentPage, '404');
});
test('back at app boundary replaces with home; internal back delegates to browser', () => {
  const r = router();
  r.context.navigate('planner', null, false);
  r.context.navigateBack();
  assert.equal(r.backs, 0);
  assert.equal(r.replaced[0][2], '#home');
  r.context.navigate('planner');
  r.context.navigateBack();
  assert.equal(r.backs, 1);
});
test('responsive shell adapts active advisor without route change', () => {
  const r = router();r.context.navigate('advisor');
  r.context.window.matchMedia = () => ({ matches: true });
  r.context.updateResponsiveShell();
  assert.equal(r.modes['chat-page-active'], true);
  assert.equal(r.modes['desktop-mode'], false);
});
test('AI detected language preserves conversation and renders answer', async () => {
  let languageChanges = 0;
  const messages = [], input = { value: 'Hello', }, send = { disabled: false };
  const context = {
    document: { getElementById: id => id === 'chat-input' ? input : send, querySelectorAll: () => [], querySelector: () => null },
    state: { chatReplyDraft: null, chatHistory: [], trackerList: [] },
    window: { currentLanguage: 'ru' },
    Auth: { isLoggedIn: () => false, fetch: async () => ({ ok: true, json: async () => ({ success: true, detectedLang: 'en', answer: 'Answer', intent: 'general' }) }) },
    setLanguage: () => languageChanges++, autoResize() {}, clearReplyQuotePreview() {}, appendMessage: (...args) => messages.push(args), saveSessionChatHistory() {}, appendTyping() {}, removeTyping() {}, showQuickSuggestions() {}, showToast() {}, t: x => x,
    Date, console, lastMessageTime: 0, MESSAGE_DELAY: 1500,
    chatPending: false, chatSessionGeneration: 0, advisorInitialMarkup: ''
  };
  vm.createContext(context);
  vm.runInContext('async ' + fn('sendMessage'), context);
  await context.sendMessage();
  assert.equal(languageChanges, 0);
  assert.equal(context.state.chatHistory.length, 2);
  assert.equal(messages[1][1], 'Answer');
  assert.equal(send.disabled, false);
});
test('first compare choice stays put, reports next step, and marks detail control', () => {
  const routes = [], notices = [], attributes = {};
  const button = { dataset: { detailCompare: '1' }, setAttribute: (key, value) => { attributes[key] = value; } };
  const context = { state: { compareList: [] }, window: { currentLanguage: 'ru' }, document: { querySelectorAll: () => [button] }, updateCompareBadge() {}, showToast: message => notices.push(message), t: value => value, navigate: page => routes.push(page) };
  vm.createContext(context);vm.runInContext(fn('addToCompareAndGo'), context);
  context.addToCompareAndGo(1);
  assert.equal(routes.length, 0);
  assert.equal(notices.length, 1);
  assert.match(notices[0], /Выбран 1 вуз.*ещё один/);
  assert.equal(attributes['aria-pressed'], 'true');
  assert.equal(button.textContent, 'card.in_compare');
  context.addToCompareAndGo(2);
  assert.equal(routes[0], 'compare');
  assert.equal(context.state.compareList.length, 2);
});
test('full compare list rejects a fourth choice without navigating', () => {
  let navigations = 0;
  const context = { state: { compareList: [1, 2, 3] }, showToast() {}, t: x => x, navigate: () => navigations++ };
  vm.createContext(context);vm.runInContext(fn('addToCompareAndGo'), context);
  context.addToCompareAndGo(4);
  assert.equal(context.state.compareList.length, 3);
  assert.equal(navigations, 0);
});
test('celebration respects reduced-motion preference', () => {
  let count = 0, reduce = true;
  const context = { window: { matchMedia: () => ({ matches: reduce }) }, confetti: () => count++ };
  vm.createContext(context);vm.runInContext(fn('celebrateCompare'), context);
  context.celebrateCompare();assert.equal(count, 0);
  reduce = false;context.celebrateCompare();assert.equal(count, 1);
});
