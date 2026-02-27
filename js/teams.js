// ─── TABS ─────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['play', 'history', 'elo'][i] === tab);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'history') renderHistory();
  if (tab === 'elo')     renderEloTab();
}

// ─── TEAM MODE ────────────────────────────────────────────────────────────
function setMode(mode) {
  teamMode = mode;
  document.getElementById('modeRandom').classList.toggle('active', mode === 'random');
  document.getElementById('modeManual').classList.toggle('active', mode === 'manual');
  document.getElementById('manualTeams').classList.toggle('visible', mode === 'manual');
  document.getElementById('generateBtn').textContent = mode === 'random' ? 'Generate Teams' : 'Set These Teams';
  document.getElementById('shuffleBtn').style.display = mode === 'random' ? '' : 'none';
  if (mode === 'manual') buildPickers();
}

function onPlayerInput() {
  updatePlayerEloBadges();
  if (teamMode === 'manual') buildPickers();
}

function updatePlayerEloBadges() {
  ['p1', 'p2', 'p3', 'p4'].forEach(id => {
    const name  = document.getElementById(id).value.trim().toUpperCase();
    const badge = document.getElementById('elo-' + id);
    if (!name) {
      badge.textContent = '—';
      badge.className   = 'input-elo-badge provisional';
      return;
    }
    badge.textContent = getPlayerElo(name);
    badge.className   = 'input-elo-badge';
  });
}

function getPlayerNames() {
  return ['p1', 'p2', 'p3', 'p4']
    .map(id => document.getElementById(id).value.trim().toUpperCase())
    .filter(Boolean);
}

// ─── MANUAL TEAM PICKERS ──────────────────────────────────────────────────
function buildPickers() {
  const names = getPlayerNames();
  manualA = manualA.filter(n => names.includes(n));
  manualB = manualB.filter(n => names.includes(n));
  renderPickers(names);
}

function renderPickers(names) {
  const eloRatings = getEloRatings();
  ['A', 'B'].forEach(team => {
    const myArr    = team === 'A' ? manualA : manualB;
    const otherArr = team === 'A' ? manualB : manualA;
    document.getElementById('picks' + team).innerHTML = names.map(name => {
      const inMe    = myArr.includes(name);
      const inOther = otherArr.includes(name);
      const cls = inMe ? (team === 'A' ? 'selected-a' : 'selected-b') : '';
      const elo = eloRatings[name]?.rating ?? ELO_DEFAULT;
      return `<button class="pick-btn ${cls}" onclick="togglePick('${team}','${name}')" ${inOther && !inMe ? 'disabled' : ''}>${name} <span style="opacity:0.6;font-size:0.75em">${elo}</span></button>`;
    }).join('');

    const slots = document.getElementById('slots' + team);
    slots.innerHTML = myArr.length === 0
      ? `<span style="font-size:0.75rem;letter-spacing:0.1em;opacity:0.3;">— no players selected —</span>`
      : myArr.map(name => `<span class="slot-chip slot-chip-${team.toLowerCase()}">${name} <button onclick="removePick('${team}','${name}')">✕</button></span>`).join('');
  });
}

function togglePick(team, name) {
  const arr   = team === 'A' ? manualA : manualB;
  const other = team === 'A' ? manualB : manualA;
  if (arr.includes(name))   { removePick(team, name); return; }
  if (other.includes(name)) return;
  if (arr.length >= 2) arr.shift();
  arr.push(name);
  renderPickers(getPlayerNames());
}

function removePick(team, name) {
  if (team === 'A') manualA = manualA.filter(n => n !== name);
  else              manualB = manualB.filter(n => n !== name);
  renderPickers(getPlayerNames());
}

// ─── GENERATE & SHUFFLE ───────────────────────────────────────────────────
function generateTeams() {
  const inputs = ['p1', 'p2', 'p3', 'p4'].map(id =>
    document.getElementById(id).value.trim().toUpperCase()
  );
  const err = document.getElementById('error');

  if (inputs.some(v => !v)) {
    err.textContent    = 'Please enter all 4 player names.';
    err.style.display  = 'block';
    return;
  }
  err.style.display = 'none';
  players = inputs;

  if (teamMode === 'manual') {
    if (manualA.length !== 2 || manualB.length !== 2) {
      err.textContent   = 'Please assign 2 players to each team.';
      err.style.display = 'block';
      return;
    }
    currentTeamA = [...manualA];
    currentTeamB = [...manualB];
    renderCourt(currentTeamA, currentTeamB);
  } else {
    shuffle();
  }
  document.getElementById('courtWrapper').style.display = 'flex';
}

function shuffle() {
  if (!players.length) return;
  const s = [...players].sort(() => Math.random() - 0.5);
  currentTeamA = [s[0], s[1]];
  currentTeamB = [s[2], s[3]];
  renderCourt(currentTeamA, currentTeamB);
}

// ─── RENDER COURT ─────────────────────────────────────────────────────────
function renderCourt(tA, tB) {
  const eloRatings = getEloRatings();
  const eA  = eloRatings[tA[0]]?.rating ?? ELO_DEFAULT;
  const eA2 = eloRatings[tA[1]]?.rating ?? ELO_DEFAULT;
  const eB  = eloRatings[tB[0]]?.rating ?? ELO_DEFAULT;
  const eB2 = eloRatings[tB[1]]?.rating ?? ELO_DEFAULT;
  const teamAElo = Math.round((eA + eA2) / 2);
  const teamBElo = Math.round((eB + eB2) / 2);

  document.getElementById('a1').textContent    = tA[0];
  document.getElementById('a2').textContent    = tA[1];
  document.getElementById('b1').textContent    = tB[0];
  document.getElementById('b2').textContent    = tB[1];
  document.getElementById('a1elo').textContent = eA;
  document.getElementById('a2elo').textContent = eA2;
  document.getElementById('b1elo').textContent = eB;
  document.getElementById('b2elo').textContent = eB2;
  document.getElementById('teamAElo').textContent = teamAElo;
  document.getElementById('teamBElo').textContent = teamBElo;

  const diff    = teamAElo - teamBElo;
  const diffStr = diff > 0 ? `+${diff} A` : diff < 0 ? `+${Math.abs(diff)} B` : 'EVEN';
  document.getElementById('courtEloMatchup').textContent = `${teamAElo} ⚡ ${teamBElo}  (${diffStr})`;

  document.getElementById('scoreTeamA').textContent = tA[0].split(' ')[0] + ' & ' + tA[1].split(' ')[0];
  document.getElementById('scoreTeamB').textContent = tB[0].split(' ')[0] + ' & ' + tB[1].split(' ')[0];
  document.getElementById('scoreA').value       = '';
  document.getElementById('scoreB').value       = '';
  document.getElementById('saveSuccess').textContent = '';
  document.getElementById('previewA').textContent    = teamAElo;
  document.getElementById('previewB').textContent    = teamBElo;
  document.getElementById('previewADelta').textContent = '';
  document.getElementById('previewBDelta').textContent = '';

  const w = document.getElementById('courtWrapper');
  w.style.animation = 'none'; w.offsetHeight; w.style.animation = 'fadeUp 0.5s ease forwards';
}

// ─── ELO PREVIEW (live delta while typing scores) ─────────────────────────
function updateEloPreview() {
  if (!currentTeamA.length) return;
  const sA = parseInt(document.getElementById('scoreA').value);
  const sB = parseInt(document.getElementById('scoreB').value);
  if (isNaN(sA) || isNaN(sB)) return;

  const eloRatings = getEloRatings();
  const rA1 = eloRatings[currentTeamA[0]]?.rating ?? ELO_DEFAULT;
  const rA2 = eloRatings[currentTeamA[1]]?.rating ?? ELO_DEFAULT;
  const rB1 = eloRatings[currentTeamB[0]]?.rating ?? ELO_DEFAULT;
  const rB2 = eloRatings[currentTeamB[1]]?.rating ?? ELO_DEFAULT;
  const avgA = (rA1 + rA2) / 2;
  const avgB = (rB1 + rB2) / 2;

  const expA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));
  const expB = 1 - expA;
  let actA, actB;
  if      (sA > sB) { actA = 1;   actB = 0;   }
  else if (sA < sB) { actA = 0;   actB = 1;   }
  else              { actA = 0.5; actB = 0.5; }

  const dA = Math.round(ELO_K * (actA - expA));
  const dB = Math.round(ELO_K * (actB - expB));

  document.getElementById('previewA').textContent = Math.round(avgA) + dA;
  document.getElementById('previewB').textContent = Math.round(avgB) + dB;

  const fmtDelta = (d) => (d >= 0 ? '+' : '') + d + ' pts each';
  document.getElementById('previewADelta').textContent = fmtDelta(dA);
  document.getElementById('previewADelta').style.color = dA >= 0 ? 'var(--green-light)' : '#e07070';
  document.getElementById('previewBDelta').textContent = fmtDelta(dB);
  document.getElementById('previewBDelta').style.color = dB >= 0 ? 'var(--green-light)' : '#e07070';
}

// ─── SAVE MATCH ───────────────────────────────────────────────────────────
async function saveMatch() {
  if (isSaving) return;
  const sA = parseInt(document.getElementById('scoreA').value);
  const sB = parseInt(document.getElementById('scoreB').value);
  if (isNaN(sA) || isNaN(sB))               { showSaveMsg('Please enter scores for both teams.', '#e07070'); return; }
  if (sA < 0 || sB < 0 || sA > 99 || sB > 99) { showSaveMsg('Scores must be between 0 and 99.',    '#e07070'); return; }
  if (!currentTeamA.length)                  { showSaveMsg('Generate teams first!',               '#e07070'); return; }

  isSaving = true;
  const btn = document.getElementById('saveBtn');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span>Saving…';

  appData.matches.unshift({
    id:     crypto.randomUUID ? crypto.randomUUID() : Date.now(),
    date:   new Date().toISOString(),
    teamA:  [...currentTeamA],
    teamB:  [...currentTeamB],
    scoreA: sA,
    scoreB: sB,
  });

  try {
    await saveToServer();
    renderEloTab();
    updatePlayerEloBadges();
    showSaveMsg('✔ Match saved & synced!', '#5fa872');
  } catch {
    showSaveMsg('⚠ Saved — sync failed. Try refreshing.', '#e07070');
  }

  btn.disabled  = false;
  btn.innerHTML = '💾 Save Result';
  isSaving = false;
}

function showSaveMsg(msg, color) {
  const el = document.getElementById('saveSuccess');
  el.textContent = msg;
  el.style.color   = color;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3500);
}
