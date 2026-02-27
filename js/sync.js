// ─── THEME TOGGLE ─────────────────────────────────────────────────────────
function toggleTheme() {
  const html    = document.documentElement;
  const isDark  = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
  try { localStorage.setItem('padel-theme', newTheme); } catch {}
}

// Apply saved theme immediately on load
(function () {
  try {
    const saved = localStorage.getItem('padel-theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      // Button may not exist yet if script runs in <head>; guard it
      const btn = document.getElementById('themeToggle');
      if (btn) btn.textContent = '🌙';
    }
  } catch {}
})();

// ─── SYNC STATUS ──────────────────────────────────────────────────────────
function setSyncStatus(state, msg) {
  document.getElementById('syncDot').className = 'sync-dot' + (state ? ' ' + state : '');
  const sub = document.getElementById('syncSub');
  sub.className   = 'sync-sub' + (state ? ' ' + state : '');
  sub.textContent = msg;
}

async function loadFromServer(silent = false) {
  setSyncStatus('syncing', 'Loading…');
  document.getElementById('syncRefreshBtn').disabled = true;
  try {
    const res  = await fetch(API_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { matches: [] }; }
    if (!Array.isArray(data.matches)) data = { matches: [] };
    appData = data;
    renderHistory();
    renderEloTab();
    updatePlayerEloBadges();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSyncStatus('ok', 'Synced ' + now);
  } catch (e) {
    console.error('Load error:', e);
    setSyncStatus('error', 'Could not connect');
    if (!silent) alert('Could not load data. Check your connection and try refreshing.');
  }
  document.getElementById('syncRefreshBtn').disabled = false;
}

async function saveToServer() {
  setSyncStatus('syncing', 'Saving…');
  await fetch(API_URL, {
    method:  'POST',
    mode:    'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(appData),
  });
  await new Promise(r => setTimeout(r, 2000));
  await loadFromServer(true);
}

// ─── EXPORT ───────────────────────────────────────────────────────────────
function exportData() {
  const eloData   = getEloRatings();
  const exportObj = {
    ...appData,
    eloRatings: Object.fromEntries(
      Object.entries(eloData).map(([k, v]) => [k, v.rating])
    ),
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'padel-score-data.json'; a.click();
  URL.revokeObjectURL(url);
}
