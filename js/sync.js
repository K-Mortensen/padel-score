// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://dxcztfstbznkxskcjezr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Y3p0ZnN0Ynpua3hza2NqZXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzQ2ODksImV4cCI6MjA5MDU1MDY4OX0.lD3vr-ssxI1kNXZiCoAD-TmYlvwy5zbK0itG7bdrSJ4';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
};

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  applyTheme(newTheme);
  try { localStorage.setItem('padel-theme', newTheme); } catch {}
}

(function () {
  try {
    const saved = localStorage.getItem('padel-theme');
    if (saved) applyTheme(saved);
  } catch {}
})();

// ─── SYNC STATUS ──────────────────────────────────────────────────────────
function setSyncStatus(state, msg) {
  document.getElementById('syncDot').className = 'sync-dot' + (state ? ' ' + state : '');
  const sub = document.getElementById('syncSub');
  sub.className = 'sync-sub' + (state ? ' ' + state : '');
  sub.textContent = msg;
}

// ─── LOAD FROM SUPABASE ───────────────────────────────────────────────────
async function loadFromServer(silent = false) {
  setSyncStatus('syncing', 'Loading…');
  document.getElementById('syncRefreshBtn').disabled = true;
  try {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/matches?select=*&order=date.desc',
      { headers: HEADERS }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();

    appData.matches = rows.map(r => ({
      id: r.id,
      date: r.date,
      format: r.format,
      teamA: r.team_a,
      teamB: r.team_b,
      scoreA: r.score_a,
      scoreB: r.score_b,
    }));

    invalidateEloCache();
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

// ─── SAVE MATCH TO SUPABASE ───────────────────────────────────────────────
async function saveToServer() {
  setSyncStatus('syncing', 'Saving…');
  const m = appData.matches[0];

  const res = await fetch(SUPABASE_URL + '/rest/v1/matches', {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      id: m.id,
      date: m.date,
      format: m.format,
      team_a: m.teamA,
      team_b: m.teamB,
      score_a: m.scoreA,
      score_b: m.scoreB,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  await loadFromServer(true);
}

// ─── UPDATE MATCH (edit modal) ────────────────────────────────────────────
async function updateMatchOnServer(match) {
  setSyncStatus('syncing', 'Saving…');

  const res = await fetch(SUPABASE_URL + '/rest/v1/matches?id=eq.' + match.id, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      date: match.date,
      format: match.format,
      team_a: match.teamA,
      team_b: match.teamB,
      score_a: match.scoreA,
      score_b: match.scoreB,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  await loadFromServer(true);
}

// ─── EXPORT ───────────────────────────────────────────────────────────────
function exportData() {
  const eloData = getEloRatings('2v2');
  const elo1v1 = getElo1v1Ratings();
  const exportObj = {
    ...appData,
    eloRatings: Object.fromEntries(Object.entries(eloData).map(([k, v]) => [k, v.rating])),
    eloRatings1v1: Object.fromEntries(Object.entries(elo1v1).map(([k, v]) => [k, v.rating])),
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'padel-firematch-data.json'; a.click();
  URL.revokeObjectURL(url);
}
