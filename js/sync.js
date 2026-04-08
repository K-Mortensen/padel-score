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
    try { localStorage.setItem('padel-theme', newTheme); } catch { }
}

(function () {
    try { const saved = localStorage.getItem('padel-theme'); if (saved) applyTheme(saved); } catch { }
})();

// ─── SYNC STATUS ──────────────────────────────────────────────────────────
function setSyncStatus(state, msg) {
    document.getElementById('syncDot').className = 'sync-dot' + (state ? ' ' + state : '');
    const sub = document.getElementById('syncSub');
    sub.className = 'sync-sub' + (state ? ' ' + state : '');
    sub.textContent = msg;
}

// ─── LOAD ─────────────────────────────────────────────────────────────────
async function loadFromServer(silent = false) {
    if (!currentClub) return;
    setSyncStatus('syncing', 'Loading…');
    document.getElementById('syncRefreshBtn').disabled = true;
    try {
        const { data: rows, error } = await supabaseClient
            .from('matches').select('*')
            .eq('club_id', currentClub.id)
            .order('date', { ascending: false });
        if (error) throw error;

        appData.matches = rows.map(r => ({
            id: r.id, date: r.date, format: r.format,
            teamA: r.team_a, teamB: r.team_b,
            scoreA: r.score_a, scoreB: r.score_b,
            ownerId: r.owner_id,
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
        if (!silent) alert('Could not load data.');
    }
    document.getElementById('syncRefreshBtn').disabled = false;
}

// ─── SAVE ─────────────────────────────────────────────────────────────────
async function saveToServer() {
    if (!currentClub || !currentUser) throw new Error('Not authenticated');
    if (!hasPermission('add_matches')) throw new Error('No permission to add matches');
    setSyncStatus('syncing', 'Saving…');
    const m = appData.matches[0];
    const { error } = await supabaseClient.from('matches').insert({
        id: m.id, date: m.date, format: m.format,
        team_a: m.teamA, team_b: m.teamB,
        score_a: m.scoreA, score_b: m.scoreB,
        club_id: currentClub.id, owner_id: currentUser.id,
    });
    if (error) throw error;
    await loadFromServer(true);
}

// ─── UPDATE ───────────────────────────────────────────────────────────────
async function updateMatchOnServer(match) {
    setSyncStatus('syncing', 'Saving…');
    const { error } = await supabaseClient.from('matches')
        .update({
            date: match.date, format: match.format,
            team_a: match.teamA, team_b: match.teamB,
            score_a: match.scoreA, score_b: match.scoreB,
        })
        .eq('id', match.id);
    if (error) throw error;
    await loadFromServer(true);
}

// ─── DELETE ───────────────────────────────────────────────────────────────
async function deleteMatchOnServer(matchId) {
    setSyncStatus('syncing', 'Deleting…');
    const { error } = await supabaseClient.from('matches').delete().eq('id', matchId);
    if (error) throw error;
    appData.matches = appData.matches.filter(m => m.id !== matchId);
    invalidateEloCache();
    renderHistory();
    renderEloTab();
    updatePlayerEloBadges();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSyncStatus('ok', 'Synced ' + now);
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
    const a = document.createElement('a'); a.href = url;
    a.download = 'padel-firematch-data.json'; a.click();
    URL.revokeObjectURL(url);
}
