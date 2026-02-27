// ─── DATE FILTER ──────────────────────────────────────────────────────────
function clearDateFilter() {
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value   = '';
  renderHistory();
}

function getFilteredMatches() {
  const from = document.getElementById('filterFrom').value;
  const to   = document.getElementById('filterTo').value;
  return appData.matches.filter(m => {
    const d = m.date.substring(0, 10);
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  });
}

// ─── RENDER HISTORY ───────────────────────────────────────────────────────
function renderHistory() {
  const filtered = getFilteredMatches();
  renderStats(filtered);
  renderMatches(filtered);
}

function renderStats(matches) {
  const grid = document.getElementById('statsGrid');
  if (!matches.length) {
    grid.innerHTML = '<div class="no-history" style="grid-column:1/-1">No matches yet. Play and save a game!</div>';
    return;
  }

  const eloData = getEloRatings();
  const ps      = {};

  matches.forEach(m => {
    const wonA = m.scoreA > m.scoreB;
    const wonB = m.scoreB > m.scoreA;
    const draw = m.scoreA === m.scoreB;
    [...m.teamA, ...m.teamB].forEach(p => {
      if (!ps[p]) ps[p] = { wins: 0, losses: 0, draws: 0, gf: 0, ga: 0 };
    });
    m.teamA.forEach(p => { ps[p].wins += wonA ? 1 : 0; ps[p].losses += wonB ? 1 : 0; ps[p].draws += draw ? 1 : 0; ps[p].gf += m.scoreA; ps[p].ga += m.scoreB; });
    m.teamB.forEach(p => { ps[p].wins += wonB ? 1 : 0; ps[p].losses += wonA ? 1 : 0; ps[p].draws += draw ? 1 : 0; ps[p].gf += m.scoreB; ps[p].ga += m.scoreA; });
  });

  grid.innerHTML = Object.entries(ps).map(([name, s]) => {
    const played   = s.wins + s.losses + s.draws;
    const wr       = played ? Math.round((s.wins / played) * 100) : 0;
    const elo      = eloData[name]?.rating ?? ELO_DEFAULT;
    const safeName = name.replace(/'/g, "\\'");
    return `<div class="stat-card" onclick="openPlayerModal('${safeName}')">
      <div class="stat-name">${name}</div>
      <div class="stat-row"><span>Elo</span><span>${elo}</span></div>
      <div class="stat-row"><span>Played</span><span>${played}</span></div>
      <div class="stat-row"><span>Wins</span><span>${s.wins}</span></div>
      <div class="stat-row"><span>Losses</span><span>${s.losses}</span></div>
      <div class="stat-row"><span>GF / GA</span><span>${s.gf} / ${s.ga}</span></div>
      <div class="stat-winrate">Win rate ${wr}%</div>
      <div class="winrate-bar"><div class="winrate-fill" style="width:${wr}%"></div></div>
      <div class="stat-card-hint">Tap for details →</div>
    </div>`;
  }).join('');
}

function renderMatches(matches) {
  const list = document.getElementById('matchList');
  if (!matches.length) {
    list.innerHTML = '<div class="no-history">No matches recorded yet.</div>';
    return;
  }
  list.innerHTML = matches.map(m => {
    const wonA = m.scoreA > m.scoreB;
    const wonB = m.scoreB > m.scoreA;
    const date = new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="match-item">
      <div class="match-team">
        <div class="match-team-names${wonA ? ' winner' : ''}">${m.teamA.join(' & ')}</div>
        <div class="match-date">${date}</div>
      </div>
      <div class="match-score-display">${m.scoreA} – ${m.scoreB}</div>
      <div class="match-team match-item-right">
        <div class="match-team-names${wonB ? ' winner' : ''}">${m.teamB.join(' & ')}</div>
      </div>
      <button class="btn-edit-match" onclick="openEditModal('${m.id}')" title="Edit match">✏️</button>
    </div>`;
  }).join('');
}
