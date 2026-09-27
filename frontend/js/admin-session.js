(() => {
  const timeout = 15 * 60 * 1000;
  let timer;

  async function signOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      window.location.replace('/?session_expired=1');
    }
  }

  function resetTimer() {
    window.clearTimeout(timer);
    timer = window.setTimeout(signOut, timeout);
  }

  ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
    document.addEventListener(event, resetTimer, { passive: true });
  });
  resetTimer();
})();
