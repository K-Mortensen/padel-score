// ─── SHARED MODAL HELPERS ─────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.body.style.overflow = '';
  if (id === 'editModal') editingMatchId = null;
}

function handleModalOverlayClick(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

// ─── EDIT MATCH MODAL ─────────────────────────────────────────────────────
function openEditModal(id) {
  const match = appData.matches.find(m => m.id === id);
  if (!match) return;

  editingMatchId = id;
  document.getElementById('editA1').value     = match.teamA[0] || '';
  document.getElementById('editA2').value     = match.teamA[1] || '';
  document.getElementById('editB1').value     = match.teamB[0] || '';
  document.getElementById('editB2').value     = match.teamB[1] || '';
  document.getElementById('editScoreA').value = match.scoreA;
  document.getElementById('editScoreB').value = match.scoreB;

  const dt  = new Date(match.date);
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('editDateTime').value =
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

  document.getElementById('editModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

async function saveEdit() {
  if (editingMatchId === null) return;

  const a1 = document.getElementById('editA1').value.trim().toUpperCase();
  const a2 = document.getElementById('editA2').value.trim().toUpperCase();
  const b1 = document.getElementById('editB1').value.trim().toUpperCase();
  const b2 = document.getElementById('editB2').value.trim().toUpperCase();
  const sA = parseInt(document.getElementById('editScoreA').value);
  const sB = parseInt(document.getElementById('editScoreB').value);
  const dtVal = document.getElementById('editDateTime').value;

  if (!a1 || !a2 || !b1 || !b2) { alert('Please fill in all player names.'); return; }
  if (isNaN(sA) || isNaN(sB))   { alert('Please enter valid scores.');       return; }

  const btn = document.getElementById('editSaveBtn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  const idx = appData.matches.findIndex(m => m.id === editingMatchId);
  if (idx !== -1) {
    const newDate = dtVal ? new Date(dtVal).toISOString() : appData.matches[idx].date;
    appData.matches[idx] = { ...appData.matches[idx], teamA: [a1, a2], teamB: [b1, b2], scoreA: sA, scoreB: sB, date: newDate };
  }

  renderHistory();
  renderEloTab();
  updatePlayerEloBadges();
  closeModal('editModal');

  try { await saveToServer(); }
  catch { setSyncStatus('error', 'Sync failed after edit'); }

  btn.disabled    = false;
  btn.textContent = '💾 Save Changes';
}

// ─── PLAYER STATS MODAL ───────────────────────────────────────────────────
function openPlayerModal(playerName) {
  const eloData      = getEloRatings();
  const playerElo    = eloData[playerName];
  const currentRating = playerElo?.rating ?? ELO_DEFAULT;
  const eloHistory   = playerElo?.history ?? [{ rating: ELO_DEFAULT }];

  const matches = appData.matches.filter(m =>
    m.teamA.includes(playerName) || m.teamB.includes(playerName)
  );

  let wins = 0, losses = 0, draws = 0, gf = 0, ga = 0;
  matches.forEach(m => {
    const inA = m.teamA.includes(playerName);
    const ps  = inA ? m.scoreA : m.scoreB;
    const os  = inA ? m.scoreB : m.scoreA;
    gf += ps; ga += os;
    if      (ps > os) wins++;
    else if (ps < os) losses++;
    else              draws++;
  });

  const played = wins + draws + losses;
  const wr     = played ? Math.round((wins / played) * 100) : 0;
  const peak   = Math.max(...eloHistory.map(h => h.rating));

  document.getElementById('pmName').textContent       = playerName;
  document.getElementById('pmEloDisplay').textContent =
    `ELO ${currentRating}${played >= ELO_MIN_GAMES_RANKED ? '' : '  (Provisional)'}`;

  document.getElementById('pmStatsGrid').innerHTML = `
    <div class="pstat-box"><div class="pstat-val">${played}</div><div class="pstat-lbl">Played</div></div>
    <div class="pstat-box"><div class="pstat-val">${wins}</div><div class="pstat-lbl">Wins</div></div>
    <div class="pstat-box"><div class="pstat-val">${losses}</div><div class="pstat-lbl">Losses</div></div>
    <div class="pstat-box"><div class="pstat-val">${draws}</div><div class="pstat-lbl">Draws</div></div>
  `;

  document.getElementById('pmWinratePct').textContent = wr + '%';
  setTimeout(() => { document.getElementById('pmWinrateFill').style.width = wr + '%'; }, 50);

  document.getElementById('pmEloPeak').textContent = `Peak: ${peak}`;
  renderEloSparkline(eloHistory, 'pmEloSpark');

  const matchHTML = matches
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(m => {
      const inA      = m.teamA.includes(playerName);
      const ps       = inA ? m.scoreA : m.scoreB;
      const os       = inA ? m.scoreB : m.scoreA;
      const myT      = inA ? m.teamA : m.teamB;
      const opT      = inA ? m.teamB : m.teamA;
      const res      = ps > os ? 'win' : ps < os ? 'loss' : 'draw';
      const resLabel = ps > os ? 'WIN' : ps < os ? 'LOSS' : 'DRAW';
      const date     = new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      const entry     = eloHistory.find(h => h.matchId === m.id);
      const delta     = entry?.delta ?? null;
      const deltaHTML = delta !== null
        ? `<div class="pm-elo-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta} ELO</div>`
        : '';

      return `<div class="player-match-item">
        <div class="pm-team">
          <div class="pm-team-names highlight">${myT.join(' & ')}</div>
          <div class="pm-date">${date}</div>
          <span class="pm-result-badge ${res}">${resLabel}</span>
          ${deltaHTML}
        </div>
        <div class="pm-score">${ps} – ${os}</div>
        <div class="pm-team pm-right">
          <div class="pm-team-names dim">${opT.join(' & ')}</div>
        </div>
      </div>`;
    }).join('') || '<div class="no-history" style="padding:20px 0">No matches found.</div>';

  document.getElementById('pmMatchList').innerHTML     = matchHTML;
  document.getElementById('playerModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// ─── ELO SPARKLINE ────────────────────────────────────────────────────────
function renderEloSparkline(history, containerId) {
  const container = document.getElementById(containerId);
  if (!container || history.length < 2) {
    container.innerHTML = '<div style="text-align:center;font-size:0.7rem;color:var(--text-faint);padding:20px 0;letter-spacing:0.1em;">Not enough data yet</div>';
    return;
  }

  const ratings = history.map(h => h.rating);
  const min     = Math.min(...ratings) - 20;
  const max     = Math.max(...ratings) + 20;
  const range   = max - min || 1;
  const W = 400, H = 60;

  const points = ratings.map((r, i) => {
    const x = (i / (ratings.length - 1)) * W;
    const y = H - ((r - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  const fillPoints = `0,${H} ${points} ${W},${H}`;
  const lastX = W;
  const lastY = H - ((ratings[ratings.length - 1] - min) / range) * H;

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#f2c94c" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#f2c94c" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${fillPoints}" fill="url(#spark-grad)"/>
      <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${lastX}" cy="${lastY}" r="3" fill="var(--accent)"/>
    </svg>`;
}
