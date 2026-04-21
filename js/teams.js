let _clubMembersForPicker = [];

// ─── TABS ─────────────────────────────────────────────────────────────────
let activeClubSubTab = 'members';

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'club') switchClubSubTab(activeClubSubTab);
}

function switchClubSubTab(sub) {
    activeClubSubTab = sub;
    document.querySelectorAll('.club-subtab-btn').forEach(b => b.classList.toggle('active', b.dataset.subtab === sub));
    document.querySelectorAll('.club-subtab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('club-sub-' + sub);
    if (panel) panel.classList.add('active');

    const subtitleMap = {
        members: 'Members & Rankings',
        stats:   'Player Stats',
        history: 'Match History',
        elo:     'Power Rankings'
    };
    const subEl = document.getElementById('clubTabSub');
    if (subEl) subEl.textContent = subtitleMap[sub] || '';

    if (sub === 'members') renderClubMembersTab();
    else if (sub === 'stats' || sub === 'history') renderHistory();
    else if (sub === 'elo') renderEloTab();
}

// ─── MATCH FORMAT (1v1 vs 2v2) ────────────────────────────────────────────
function setFormat(format) {
    matchFormat = format;
    document.getElementById('format2v2').classList.toggle('active', format === '2v2');
    document.getElementById('format1v1').classList.toggle('active', format === '1v1');

    const is1v1 = format === '1v1';

    // Show/hide player inputs 3 & 4
    document.getElementById('inputRow3').style.display = is1v1 ? 'none' : '';
    document.getElementById('inputRow4').style.display = is1v1 ? 'none' : '';

    // Adjust court: show only 1 card per side in 1v1 mode
    document.getElementById('playerCard2A').style.display = is1v1 ? 'none' : '';
    document.getElementById('playerCard2B').style.display = is1v1 ? 'none' : '';

    // Hide shuffle in 1v1 (only 2 players, no shuffle needed)
    document.getElementById('shuffleBtn').style.display = (teamMode === 'random' && !is1v1) ? '' : 'none';

    // Reset mode to random in 1v1 (manual picks don't make sense)
    if (is1v1) {
        setMode('random', true);
        document.getElementById('modeManual').disabled = true;
        document.getElementById('modeManual').style.opacity = '0.4';
    } else {
        document.getElementById('modeManual').disabled = false;
        document.getElementById('modeManual').style.opacity = '';
    }

    // Clear state
    currentTeamA = [];
    currentTeamB = [];
    document.getElementById('courtWrapper').style.display = 'none';
    updatePlayerEloBadges();
    renderMemberPicker();
}

// ─── TEAM MODE ────────────────────────────────────────────────────────────
function setMode(mode, skipBuildPickers) {
    teamMode = mode;
    document.getElementById('modeRandom').classList.toggle('active', mode === 'random');
    document.getElementById('modeManual').classList.toggle('active', mode === 'manual');
    document.getElementById('manualTeams').classList.toggle('visible', mode === 'manual');
    document.getElementById('generateBtn').textContent = mode === 'random' ? 'Generate Teams' : 'Set These Teams';
    document.getElementById('shuffleBtn').style.display = (mode === 'random' && matchFormat !== '1v1') ? '' : 'none';
    if (mode === 'manual' && !skipBuildPickers) buildPickers();
}

function onPlayerInput() {
    updatePlayerEloBadges();
    if (teamMode === 'manual') buildPickers();
    renderMemberPicker();
}

function updatePlayerEloBadges() {
    const fmt = matchFormat || '2v2';
    const ratings = getEloRatings(fmt);
    ['p1', 'p2', 'p3', 'p4'].forEach(id => {
        const input = document.getElementById(id);
        const badge = document.getElementById('elo-' + id);
        if (!input || !badge) return;
        const name = input.value.trim().toUpperCase();
        if (!name) {
            badge.textContent = '—';
            badge.className = 'input-elo-badge provisional';
            return;
        }
        badge.textContent = ratings[name]?.rating ?? ELO_DEFAULT;
        badge.className = 'input-elo-badge';
    });
}

function getPlayerNames() {
    const ids = matchFormat === '1v1' ? ['p1', 'p2'] : ['p1', 'p2', 'p3', 'p4'];
    return ids.map(id => document.getElementById(id).value.trim().toUpperCase()).filter(Boolean);
}

// ─── MANUAL TEAM PICKERS ──────────────────────────────────────────────────
function buildPickers() {
    const names = getPlayerNames();
    manualA = manualA.filter(n => names.includes(n));
    manualB = manualB.filter(n => names.includes(n));
    renderPickers(names);
}

function renderPickers(names) {
    const eloRatings = getEloRatings(matchFormat || '2v2');
    ['A', 'B'].forEach(team => {
        const myArr = team === 'A' ? manualA : manualB;
        const otherArr = team === 'A' ? manualB : manualA;
        document.getElementById('picks' + team).innerHTML = names.map(name => {
            const inMe = myArr.includes(name);
            const inOther = otherArr.includes(name);
            const cls = inMe ? (team === 'A' ? 'selected-a' : 'selected-b') : '';
            const elo = eloRatings[name]?.rating ?? ELO_DEFAULT;
            return `<button class="pick-btn ${cls}" onclick="togglePick('${team}','${esc(name)}')" ${inOther && !inMe ? 'disabled' : ''}>${esc(name)} <span style="opacity:0.6;font-size:0.75em">${elo}</span></button>`;
        }).join('');

        const slots = document.getElementById('slots' + team);
        slots.innerHTML = myArr.length === 0
            ? `<span style="font-size:0.75rem;letter-spacing:0.1em;opacity:0.3;">— no players selected —</span>`
            : myArr.map(name => `<span class="slot-chip slot-chip-${team.toLowerCase()}">${esc(name)} <button onclick="removePick('${team}','${esc(name)}')">✕</button></span>`).join('');
    });
}

function togglePick(team, name) {
    const arr = team === 'A' ? manualA : manualB;
    const other = team === 'A' ? manualB : manualA;
    if (arr.includes(name)) { removePick(team, name); return; }
    if (other.includes(name)) return;
    if (arr.length >= 2) arr.shift();
    arr.push(name);
    renderPickers(getPlayerNames());
}

function removePick(team, name) {
    if (team === 'A') manualA = manualA.filter(n => n !== name);
    else manualB = manualB.filter(n => n !== name);
    renderPickers(getPlayerNames());
}

// ─── GENERATE & SHUFFLE ───────────────────────────────────────────────────
function generateTeams() {
    const is1v1 = matchFormat === '1v1';
    const ids = is1v1 ? ['p1', 'p2'] : ['p1', 'p2', 'p3', 'p4'];
    const inputs = ids.map(id => document.getElementById(id).value.trim().toUpperCase());
    const err = document.getElementById('error');

    if (inputs.some(v => !v)) {
        err.textContent = `Please enter ${is1v1 ? 2 : 4} player names.`;
        err.style.display = 'block';
        return;
    }
    err.style.display = 'none';
    players = inputs;

    if (is1v1) {
        currentTeamA = [players[0]];
        currentTeamB = [players[1]];
        renderCourt(currentTeamA, currentTeamB);
    } else if (teamMode === 'manual') {
        if (manualA.length !== 2 || manualB.length !== 2) {
            err.textContent = 'Please assign 2 players to each team.';
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
    if (!players.length || matchFormat === '1v1') return;
    const s = [...players];
    for (let i = s.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s[i], s[j]] = [s[j], s[i]];
    }
    currentTeamA = [s[0], s[1]];
    currentTeamB = [s[2], s[3]];
    renderCourt(currentTeamA, currentTeamB);
}

// ─── RENDER COURT ─────────────────────────────────────────────────────────
function renderCourt(tA, tB) {
    const fmt = matchFormat || '2v2';
    const eloRatings = getEloRatings(fmt);
    const is1v1 = fmt === '1v1';

    const eA = eloRatings[tA[0]]?.rating ?? ELO_DEFAULT;
    const eA2 = tA[1] ? (eloRatings[tA[1]]?.rating ?? ELO_DEFAULT) : null;
    const eB = eloRatings[tB[0]]?.rating ?? ELO_DEFAULT;
    const eB2 = tB[1] ? (eloRatings[tB[1]]?.rating ?? ELO_DEFAULT) : null;

    const teamAElo = getTeamElo(tA, fmt);
    const teamBElo = getTeamElo(tB, fmt);

    // Corner labels
    document.getElementById('cornerLabelA').textContent = is1v1 ? tA[0] : 'TEAM A';
    document.getElementById('cornerLabelB').textContent = is1v1 ? tB[0] : 'TEAM B';

    // Player cards
    document.getElementById('a1').textContent = tA[0];
    document.getElementById('a1elo').textContent = eA;
    document.getElementById('b1').textContent = tB[0];
    document.getElementById('b1elo').textContent = eB;

    if (!is1v1) {
        document.getElementById('a2').textContent = tA[1] || '—';
        document.getElementById('a2elo').textContent = eA2 ?? '—';
        document.getElementById('b2').textContent = tB[1] || '—';
        document.getElementById('b2elo').textContent = eB2 ?? '—';
    }

    document.getElementById('teamAElo').textContent = teamAElo;
    document.getElementById('teamBElo').textContent = teamBElo;

    const diff = teamAElo - teamBElo;
    const diffStr = diff > 0 ? `+${diff} A` : diff < 0 ? `+${Math.abs(diff)} B` : 'EVEN';
    document.getElementById('courtEloMatchup').textContent = `${teamAElo} ⚡ ${teamBElo}  (${diffStr})`;

    const nameA = is1v1 ? tA[0] : tA[0].split(' ')[0] + ' & ' + tA[1].split(' ')[0];
    const nameB = is1v1 ? tB[0] : tB[0].split(' ')[0] + ' & ' + tB[1].split(' ')[0];
    document.getElementById('scoreTeamA').textContent = nameA;
    document.getElementById('scoreTeamB').textContent = nameB;
    document.getElementById('scoreA').value = '';
    document.getElementById('scoreB').value = '';
    document.getElementById('saveSuccess').textContent = '';
    document.getElementById('previewA').textContent = teamAElo;
    document.getElementById('previewB').textContent = teamBElo;
    document.getElementById('previewADelta').textContent = '';
    document.getElementById('previewBDelta').textContent = '';

    const w = document.getElementById('courtWrapper');
    w.style.animation = 'none'; w.offsetHeight; w.style.animation = 'fadeUp 0.5s ease forwards';
}

// ─── ELO PREVIEW ──────────────────────────────────────────────────────────
function updateEloPreview() {
    if (!currentTeamA.length) return;
    const sA = parseInt(document.getElementById('scoreA').value, 10);
    const sB = parseInt(document.getElementById('scoreB').value, 10);
    if (isNaN(sA) || isNaN(sB)) return;

    const fmt = matchFormat || '2v2';
    const is1v1 = fmt === '1v1';
    const avgA = getTeamElo(currentTeamA, fmt);
    const avgB = getTeamElo(currentTeamB, fmt);
    const { dA, dB } = computeEloDelta(avgA, avgB, sA, sB);

    document.getElementById('previewA').textContent = avgA + dA;
    document.getElementById('previewB').textContent = avgB + dB;

    const fmtDelta = (d) => (d >= 0 ? '+' : '') + d + ' pts';
    document.getElementById('previewADelta').textContent = fmtDelta(dA) + (is1v1 ? '' : ' each');
    document.getElementById('previewADelta').style.color = dA >= 0 ? 'var(--green-light)' : '#e07070';
    document.getElementById('previewBDelta').textContent = fmtDelta(dB) + (is1v1 ? '' : ' each');
    document.getElementById('previewBDelta').style.color = dB >= 0 ? 'var(--green-light)' : '#e07070';
}

// ─── SAVE MATCH ───────────────────────────────────────────────────────────
async function saveMatch() {
    if (isSaving) return;
    const sA = parseInt(document.getElementById('scoreA').value, 10);
    const sB = parseInt(document.getElementById('scoreB').value, 10);
    if (isNaN(sA) || isNaN(sB)) { showSaveMsg('Please enter scores for both teams.', '#e07070'); return; }
    if (sA < 0 || sB < 0 || sA > 99 || sB > 99) { showSaveMsg('Scores must be between 0 and 99.', '#e07070'); return; }
    if (!currentTeamA.length) { showSaveMsg('Generate teams first!', '#e07070'); return; }

    isSaving = true;
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Saving…';

    appData.matches.unshift({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now(),
        date: new Date().toISOString(),
        format: matchFormat || '2v2',
        teamA: [...currentTeamA],
        teamB: [...currentTeamB],
        scoreA: sA,
        scoreB: sB,
    });
    invalidateEloCache();

    try {
        await saveToServer();
        renderEloTab();
        updatePlayerEloBadges();
        showSaveMsg('✔ Match saved & synced!', '#5fa872');
    } catch {
        showSaveMsg('⚠ Saved — sync failed. Try refreshing.', '#e07070');
    }

    btn.disabled = false;
    btn.innerHTML = '💾 Save Result';
    isSaving = false;
}

function showSaveMsg(msg, color) {
    const el = document.getElementById('saveSuccess');
    el.textContent = msg;
    el.style.color = color;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 3500);
}

// ─── MEMBER PICKER ────────────────────────────────────────────────────────
async function loadMemberPicker() {
    const panel = document.getElementById('memberPickerPanel');
    if (!currentClub || !panel) return;
    _clubMembersForPicker = await loadClubMembers();
    panel.style.display = '';
    renderMemberPicker();
}

function renderMemberPicker() {
    const list = document.getElementById('memberPickerList');
    if (!list) return;
    const search = (document.getElementById('memberPickerSearch')?.value || '').trim().toUpperCase();
    const ids = matchFormat === '1v1' ? ['p1', 'p2'] : ['p1', 'p2', 'p3', 'p4'];
    const currentNames = ids.map(id => document.getElementById(id)?.value.trim().toUpperCase()).filter(Boolean);

    const chips = _clubMembersForPicker
        .map(m => (m.profiles?.username || m.profiles?.display_name || '').toUpperCase())
        .filter(name => name && (!search || name.includes(search)));

    list.innerHTML = chips.map(name => {
        const sel = currentNames.includes(name);
        return `<button class="member-chip${sel ? ' selected' : ''}" onclick="selectMemberForInput('${esc(name)}')">${esc(name)}</button>`;
    }).join('');
}

function filterMemberPicker() { renderMemberPicker(); }

function selectMemberForInput(name) {
    const ids = matchFormat === '1v1' ? ['p1', 'p2'] : ['p1', 'p2', 'p3', 'p4'];
    for (const id of ids) {
        const input = document.getElementById(id);
        if (input && !input.value.trim()) {
            input.value = name;
            onPlayerInput();
            return;
        }
    }
    // All slots already filled — no-op
}
