// ─── ELO TAB ──────────────────────────────────────────────────────────────
let eloTabView = '2v2'; // '2v2' or '1v1'

function setEloTabView(view) {
    eloTabView = view;
    document.getElementById('eloView2v2').classList.toggle('active', view === '2v2');
    document.getElementById('eloView1v1').classList.toggle('active', view === '1v1');
    renderEloTab();
}

function renderEloTab() {
    const container = document.getElementById('eloLeaderboard');
    const eloData = eloTabView === '1v1' ? getElo1v1Ratings() : getEloRatings('2v2');

    // Update subtitle
    const desc = document.getElementById('eloHeaderDesc');
    if (desc) {
        desc.textContent = eloTabView === '1v1'
            ? 'Solo 1v1 rankings · Starting Elo 1200 · K-factor 32 · Min 3 games for ranked status · Click a player for details'
            : 'Team 2v2 rankings · Starting Elo 1200 · K-factor 32 · Min 3 games for ranked status · Click a player for details';
    }

    if (!Object.keys(eloData).length) {
        container.innerHTML = `<div class="no-history">No ${eloTabView} matches yet. Play some games to build rankings!</div>`;
        return;
    }

    const sorted = Object.entries(eloData).sort((a, b) => b[1].rating - a[1].rating);
    const ranked = sorted.filter(([, d]) => d.gamesPlayed >= ELO_MIN_GAMES_RANKED);
    const provisional = sorted.filter(([, d]) => d.gamesPlayed < ELO_MIN_GAMES_RANKED);

    let html = '';
    ranked.forEach(([name, data], idx) => {
        html += buildEloRow(name, data, idx + 1, false);
    });

    if (provisional.length) {
        html += `<div class="elo-section-divider"><span>PROVISIONAL (< ${ELO_MIN_GAMES_RANKED} games)</span></div>`;
        provisional.forEach(([name, data]) => {
            html += buildEloRow(name, data, null, true);
        });
    }

    container.innerHTML = html;
}

function buildEloRow(name, data, rank, isProvisional) {
    const fmt = eloTabView;

    // Last 5 matches of correct format for form dots
    const playerMatches = appData.matches
        .filter(m => (m.format || '2v2') === fmt && (m.teamA.includes(name) || m.teamB.includes(name)))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    const formDots = playerMatches.map(m => {
        const inA = m.teamA.includes(name);
        const ps = inA ? m.scoreA : m.scoreB;
        const os = inA ? m.scoreB : m.scoreA;
        if (ps > os) return '<span class="form-dot w" title="Win"></span>';
        if (ps < os) return '<span class="form-dot l" title="Loss"></span>';
        return '<span class="form-dot d" title="Draw"></span>';
    }).join('');

    const hist = data.history;
    const lastDelta = hist.length > 1 ? hist[hist.length - 1].delta : 0;
    const deltaStr = lastDelta > 0 ? `+${lastDelta}` : lastDelta < 0 ? `${lastDelta}` : '—';
    const deltaClass = lastDelta > 0 ? 'up' : lastDelta < 0 ? 'down' : 'flat';

    let fW = 0, fD = 0, fL = 0;
    appData.matches
        .filter(m => (m.format || '2v2') === fmt)
        .forEach(m => {
            if (!m.teamA.includes(name) && !m.teamB.includes(name)) return;
            const inA = m.teamA.includes(name);
            const ps = inA ? m.scoreA : m.scoreB;
            const os = inA ? m.scoreB : m.scoreA;
            if (ps > os) fW++;
            else if (ps < os) fL++;
            else fD++;
        });

    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
    const provClass = isProvisional ? ' provisional' : '';
    const rankDisplay = rank ?? '?';
    const safeName = name.replace(/'/g, "\\'");

    return `
    <div class="elo-row ${rankClass}${provClass}" onclick="openPlayerModal('${safeName}','${fmt}')" style="animation-delay:${(rank || 10) * 0.05}s">
      <div class="elo-rank">${rankDisplay}</div>
      <div class="elo-player-info">
        <div class="elo-player-name">${name}</div>
        <div class="elo-player-meta">
          <span class="elo-meta-chip">${data.gamesPlayed}P</span>
          <span class="elo-meta-chip win">${fW}W</span>
          <span class="elo-meta-chip loss">${fL}L</span>
          ${fD > 0 ? `<span class="elo-meta-chip">${fD}D</span>` : ''}
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
