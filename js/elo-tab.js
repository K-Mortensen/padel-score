// ─── ELO TAB ──────────────────────────────────────────────────────────────
let activeEloFormat = '2v2'; // '2v2' or '1v1'
const RECENT_FORM_LIMIT = 5;

function setEloTabView(view) {
    activeEloFormat = view;
    document.getElementById('eloView2v2').classList.toggle('active', view === '2v2');
    document.getElementById('eloView1v1').classList.toggle('active', view === '1v1');
    renderEloTab();
}

// Precompute per-player W/L/D stats and recent form for the given format
// in a single pass over matches, instead of filtering per player (O(n*m) -> O(m)).
function computePlayerStats(fmt) {
    const stats = {};   // { name: { w, l, d, recent: [{result, date}] } }

    appData.matches.forEach(m => {
        if ((m.format || '2v2') !== fmt) return;
        const process = (team, ps, os) => {
            team.forEach(name => {
                if (!stats[name]) stats[name] = { w: 0, l: 0, d: 0, recent: [] };
                const res = ps > os ? 'w' : ps < os ? 'l' : 'd';
                stats[name][res]++;
                stats[name].recent.push({ res, date: m.date });
            });
        };
        process(m.teamA, m.scoreA, m.scoreB);
        process(m.teamB, m.scoreB, m.scoreA);
    });

    // Sort recent matches newest-first and keep only the most recent
    Object.values(stats).forEach(s => {
        s.recent.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        s.recent = s.recent.slice(0, RECENT_FORM_LIMIT);
    });

    return stats;
}

function renderEloTab() {
    const container = document.getElementById('eloLeaderboard');
    const eloData = activeEloFormat === '1v1' ? getElo1v1Ratings() : getEloRatings('2v2');

    // Update subtitle
    const desc = document.getElementById('eloHeaderDesc');
    if (desc) {
        desc.textContent = activeEloFormat === '1v1'
            ? 'Solo 1v1 rankings · Starting Elo 1200 · K-factor 32 · Min 3 games for ranked status · Click a player for details'
            : 'Team 2v2 rankings · Starting Elo 1200 · K-factor 32 · Min 3 games for ranked status · Click a player for details';
    }

    if (!Object.keys(eloData).length) {
        container.innerHTML = `<div class="no-history">No ${activeEloFormat} matches yet. Play some games to build rankings!</div>`;
        return;
    }

    const playerStats = computePlayerStats(activeEloFormat);

    const sorted = Object.entries(eloData).sort((a, b) => b[1].rating - a[1].rating);
    const ranked = sorted.filter(([, d]) => d.gamesPlayed >= ELO_MIN_GAMES_RANKED);
    const provisional = sorted.filter(([, d]) => d.gamesPlayed < ELO_MIN_GAMES_RANKED);

    let html = '';
    ranked.forEach(([name, data], idx) => {
        html += buildEloRow(name, data, idx + 1, false, playerStats[name]);
    });

    if (provisional.length) {
        html += `<div class="elo-section-divider"><span>PROVISIONAL (< ${ELO_MIN_GAMES_RANKED} games)</span></div>`;
        provisional.forEach(([name, data]) => {
            html += buildEloRow(name, data, null, true, playerStats[name]);
        });
    }

    container.innerHTML = html;
}

function buildEloRow(name, data, rank, isProvisional, stats) {
    const format = activeEloFormat;
    const playerStats = stats || { w: 0, l: 0, d: 0, recent: [] };

    const formDots = playerStats.recent.map(r => {
        if (r.res === 'w') return '<span class="form-dot w" title="Win"></span>';
        if (r.res === 'l') return '<span class="form-dot l" title="Loss"></span>';
        return '<span class="form-dot d" title="Draw"></span>';
    }).join('');

    const hist = data.history;
    const lastDelta = hist.length > 1 ? hist[hist.length - 1].delta : 0;
    const deltaStr = lastDelta > 0 ? `+${lastDelta}` : lastDelta < 0 ? `${lastDelta}` : '—';
    const deltaClass = lastDelta > 0 ? 'up' : lastDelta < 0 ? 'down' : 'flat';

    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
    const provClass = isProvisional ? ' provisional' : '';
    const rankDisplay = rank ?? '?';

    return `
    <div class="elo-row ${rankClass}${provClass}" onclick="openPlayerModal('${esc(name)}','${format}')" style="animation-delay:${(rank || 10) * 0.05}s">
      <div class="elo-rank">${rankDisplay}</div>
      <div class="elo-player-info">
        <div class="elo-player-name">${esc(name)}</div>
        <div class="elo-player-meta">
          <span class="elo-meta-chip">${data.gamesPlayed}P</span>
          <span class="elo-meta-chip win">${playerStats.w}W</span>
          <span class="elo-meta-chip loss">${playerStats.l}L</span>
          ${playerStats.d > 0 ? `<span class="elo-meta-chip">${playerStats.d}D</span>` : ''}
          ${isProvisional ? `<span class="elo-meta-chip prov">Provisional</span>` : ''}
        </div>
        <div class="elo-form">${formDots}</div>
      </div>
      <div class="elo-rating-block">
        <div class="elo-rating-val">${data.rating}</div>
        <div class="elo-rating-delta ${deltaClass}">${deltaStr !== '—' ? deltaStr + ' last' : '—'}</div>
        <div class="elo-rating-lbl">ELO</div>
      </div>
    </div>`;
}
