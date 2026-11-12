import { MAX_SCORE } from '../config.js';
import { state, saveDraft, can, keyOf, myKey, displayName, memberName } from '../state.js';
import { ratingOf, teamRating, expected, eloDelta, ratings } from '../elo.js';
import * as api from '../api.js';
import { esc, icon, avatar, toast, errMsg, openSheet, closeSheet, sheetHead, busy, signed } from '../ui.js';
import { matchCard } from './matches.js';
import { noClubState } from './club.js';

const d = () => state.draft;
const activeSlots = () => (d().format === '1v1' ? [0, 2] : [0, 1, 2, 3]);
const teamOf = side => (d().format === '1v1'
    ? [d().slots[side === 'A' ? 0 : 2]]
    : side === 'A' ? [d().slots[0], d().slots[1]] : [d().slots[2], d().slots[3]]);
const complete = () => activeSlots().every(i => d().slots[i]);

function slot(i) {
    const key = d().slots[i];
    const team = i < 2 ? 'a' : 'b';
    if (!key) {
        return `<button class="slot slot-empty slot-${team}" data-action="pickPlayer" data-slot="${i}">
            <span class="slot-plus">${icon('plus')}</span><span class="slot-name">Add player</span></button>`;
    }
    return `<button class="slot slot-${team}" data-action="pickPlayer" data-slot="${i}">
        ${avatar(key, 'sm')}
        <span class="slot-text"><span class="slot-name">${esc(displayName(key))}</span>
        <span class="slot-elo">${ratingOf(key, d().format)} rating</span></span></button>`;
}

function court() {
    const is1 = d().format === '1v1';
    const side = (idx, label, team) => `
        <div class="court-side court-${team}">
            <span class="court-label">${label}</span>
            <div class="court-slots${is1 ? ' single' : ''}">${idx.map(slot).join('')}</div>
        </div>`;
    return `<div class="court">
        ${side(is1 ? [0] : [0, 1], 'Team A', 'a')}
        <div class="court-net"><span>VS</span></div>
        ${side(is1 ? [2] : [2, 3], 'Team B', 'b')}
    </div>`;
}

function odds() {
    if (!complete()) return '';
    const f = d().format;
    const rA = teamRating(teamOf('A'), f), rB = teamRating(teamOf('B'), f);
    const pA = Math.round(expected(rA, rB) * 100);
    return `<div class="odds">
        <div class="odds-labels"><span class="ta">${pA}%</span><span class="muted">Win chance</span><span class="tb">${100 - pA}%</span></div>
        <div class="odds-bar"><i style="width:${pA}%"></i></div>
    </div>`;
}

function stepper(side) {
    const v = side === 'A' ? d().scoreA : d().scoreB;
    const names = teamOf(side).filter(Boolean).map(k => displayName(k).split(' ')[0]).join(' & ') || `Team ${side}`;
    return `<div class="score-side score-${side.toLowerCase()}">
        <div class="score-team">${esc(names)}</div>
        <div class="stepper">
            <button class="step" data-action="score" data-side="${side}" data-d="-1" aria-label="Decrease">${icon('minus')}</button>
            <input class="score-input" type="number" inputmode="numeric" min="0" max="${MAX_SCORE}" value="${v}" data-input="score" data-side="${side}" aria-label="Team ${side} games">
            <button class="step" data-action="score" data-side="${side}" data-d="1" aria-label="Increase">${icon('plus')}</button>
        </div>
    </div>`;
}

function preview() {
    const { scoreA, scoreB, format } = d();
    if (!complete() || (scoreA === 0 && scoreB === 0)) return `<p class="hint">Enter games won by each team</p>`;
    const { dA, dB } = eloDelta(teamRating(teamOf('A'), format), teamRating(teamOf('B'), format), scoreA, scoreB);
    const chip = (v, t) => `<span class="delta ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">Team ${t} ${signed(v)}</span>`;
    return `<p class="hint">Rating change ${chip(dA, 'A')} ${chip(dB, 'B')}</p>`;
}

export function render() {
    if (!state.club) return noClubState();
    const f = d().format;
    const canAdd = can('add_matches');
    const recent = state.matches.slice(0, 3);
    const ready = complete();
    return `
    <section class="card play-card">
        <div class="card-head">
            <h2>New match</h2>
            <div class="seg" role="tablist">
                <button class="${f === '2v2' ? 'on' : ''}" data-action="format" data-f="2v2">Doubles</button>
                <button class="${f === '1v1' ? 'on' : ''}" data-action="format" data-f="1v1">Singles</button>
            </div>
        </div>
        ${court()}
        <div class="court-tools">
            ${f === '2v2' ? `
            <button class="chip-btn" data-action="shuffle" ${ready ? '' : 'disabled'}>${icon('shuffle')}Shuffle</button>
            <button class="chip-btn" data-action="balance" ${ready ? '' : 'disabled'}>${icon('scale')}Balance</button>` : ''}
            <button class="chip-btn" data-action="swapSides" ${d().slots.some(Boolean) ? '' : 'disabled'}>${icon('swap')}Swap</button>
            <button class="chip-btn" data-action="clearSlots" ${d().slots.some(Boolean) ? '' : 'disabled'}>${icon('x')}Clear</button>
        </div>
        ${odds()}
    </section>

    <section class="card score-card${ready ? '' : ' is-disabled'}">
        <h2>Result</h2>
        <div class="score-grid">
            ${stepper('A')}
            <div class="score-dash">–</div>
            ${stepper('B')}
        </div>
        <div id="eloPreview">${preview()}</div>
        <button class="btn btn-primary btn-lg btn-block" data-action="saveMatch" ${ready && canAdd ? '' : 'disabled'}>
            ${icon('check')}Save match
        </button>
        ${!canAdd ? `<p class="hint">Your role can't add matches in this club.</p>` : ''}
    </section>

    ${recent.length && can('view_scores') ? `
    <section class="section">
        <div class="section-head"><h2>Latest</h2><button class="link" data-action="tab" data-tab="matches">See all ${icon('right')}</button></div>
        <div class="stack">${recent.map(matchCard).join('')}</div>
    </section>` : ''}`;
}

// Fill slot 0 with me on first visit to an empty draft.
export function seedDraft() {
    if (!d().slots.some(Boolean) && myKey()) { d().slots[0] = myKey(); saveDraft(); }
}

function updateScoreUI() {
    const p = document.getElementById('eloPreview');
    if (p) p.innerHTML = preview();
}

// ─── Player picker ────────────────────────────────────────────────────────
let pickSlot = 0, pickQuery = '';

function pickerList() {
    const f = d().format;
    const q = pickQuery.trim().toUpperCase();
    const r = ratings(f);
    const memberKeys = state.members.map(m => keyOf(memberName(m)));
    const others = [...new Set(state.matches.flatMap(m => [...m.teamA, ...m.teamB]))].filter(k => !memberKeys.includes(k));
    const games = k => r[k]?.games || 0;
    const sortKeys = keys => keys.sort((a, b) => (b === myKey()) - (a === myKey()) || games(b) - games(a) || a.localeCompare(b));
    const match = k => !q || k.includes(q) || displayName(k).toUpperCase().includes(q);
    const row = k => {
        const at = d().slots.indexOf(k);
        const tag = at === pickSlot ? '<span class="tag">Selected</span>'
            : at >= 0 && activeSlots().includes(at) ? `<span class="tag">Team ${at < 2 ? 'A' : 'B'}</span>` : '';
        return `<button class="row row-btn" data-action="choosePlayer" data-key="${esc(k)}">
            ${avatar(k, 'md')}
            <span class="row-main"><b>${esc(displayName(k))}</b><small>${k === myKey() ? 'You · ' : ''}${ratingOf(k, f)} rating · ${games(k)} played</small></span>
            ${tag}
        </button>`;
    };
    const mem = sortKeys(memberKeys.filter(match));
    const gst = sortKeys(others.filter(match));
    const exact = q && [...memberKeys, ...others].includes(q);
    let html = '';
    const addRow = q && !exact ? `<button class="row row-btn row-add" data-action="choosePlayer" data-key="${esc(q)}">
            <span class="av av-md av-add">${icon('plus')}</span>
            <span class="row-main"><b>Add “${esc(displayName(q))}”</b><small>Play with a guest who isn't in the club</small></span></button>` : '';
    if (!mem.length && !gst.length) html += addRow;
    if (mem.length) html += `<div class="list-label">Club members</div>${mem.map(row).join('')}`;
    if (gst.length) html += `<div class="list-label">Guests</div>${gst.map(row).join('')}`;
    if ((mem.length || gst.length) && addRow) html += `<div class="list-label">New guest</div>${addRow}`;
    if (!html) html = `<p class="hint">No players found</p>`;
    return html;
}

function pickerSheet() {
    const filled = d().slots[pickSlot];
    return `${sheetHead(`Team ${pickSlot < 2 ? 'A' : 'B'} player`)}
        <div class="search">${icon('search')}<input class="input" placeholder="Search or type a guest name" value="${esc(pickQuery)}" data-input="pickSearch" autocomplete="off" autofocus></div>
        <div class="list" id="pickList">${pickerList()}</div>
        ${filled ? `<button class="btn btn-ghost btn-block" data-action="removePlayer">${icon('x')}Remove ${esc(displayName(filled))}</button>` : ''}`;
}

// ─── Actions ──────────────────────────────────────────────────────────────
export const actions = {
    format(el, app) {
        const f = el.dataset.f;
        if (f === d().format) return;
        const s = d().slots;
        if (f === '1v1') { // compact each side to its first slot
            if (!s[0] && s[1]) { s[0] = s[1]; s[1] = ''; }
            if (!s[2] && s[3]) { s[2] = s[3]; s[3] = ''; }
        }
        d().format = f;
        saveDraft(); app.render();
    },
    pickPlayer(el) {
        pickSlot = +el.dataset.slot; pickQuery = '';
        openSheet('picker', pickerSheet, { live: false });
    },
    choosePlayer(el, app) {
        const key = keyOf(el.dataset.key);
        const s = d().slots;
        const at = s.indexOf(key);
        if (at >= 0 && at !== pickSlot) s[at] = s[pickSlot]; // swap if already placed
        s[pickSlot] = key;
        saveDraft(); closeSheet('picker'); app.render();
    },
    removePlayer(el, app) {
        d().slots[pickSlot] = '';
        saveDraft(); closeSheet('picker'); app.render();
    },
    shuffle(el, app) {
        const keys = activeSlots().map(i => d().slots[i]);
        for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
        d().slots = keys;
        saveDraft(); app.render();
    },
    balance(el, app) {
        const [a, b, c, e] = d().slots;
        const options = [[a, b, c, e], [a, c, b, e], [a, e, b, c]];
        const diff = o => Math.abs((ratingOf(o[0]) + ratingOf(o[1])) - (ratingOf(o[2]) + ratingOf(o[3])));
        const best = Math.min(...options.map(diff));
        const pool = options.filter(o => diff(o) === best);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        d().slots = Math.random() < 0.5 ? pick : [pick[2], pick[3], pick[0], pick[1]];
        saveDraft(); app.render();
        toast(best === 0 ? 'Perfectly balanced teams' : `Teams balanced · ${Math.round(best / 2)} rating apart`);
    },
    swapSides(el, app) {
        const [a, b, c, e] = d().slots;
        d().slots = [c, e, a, b];
        [d().scoreA, d().scoreB] = [d().scoreB, d().scoreA];
        saveDraft(); app.render();
    },
    clearSlots(el, app) {
        d().slots = ['', '', '', ''];
        d().scoreA = d().scoreB = 0;
        saveDraft(); app.render();
    },
    score(el, app) {
        const k = el.dataset.side === 'A' ? 'scoreA' : 'scoreB';
        d()[k] = Math.max(0, Math.min(MAX_SCORE, d()[k] + Number(el.dataset.d)));
        const input = document.querySelector(`.score-input[data-side="${el.dataset.side}"]`);
        if (input) input.value = d()[k];
        updateScoreUI();
    },
    async saveMatch(el, app) {
        const { format, scoreA, scoreB } = d();
        if (!complete()) return toast('Add all players first', 'error');
        if (scoreA === 0 && scoreB === 0) return toast('Enter the score first', 'error');
        const teamA = teamOf('A'), teamB = teamOf('B');
        if (new Set([...teamA, ...teamB]).size !== teamA.length + teamB.length) return toast('A player can only be on court once', 'error');
        await busy(el, async () => {
            try {
                const before = teamRating(teamA, format), beforeB = teamRating(teamB, format);
                const { dA } = eloDelta(before, beforeB, scoreA, scoreB);
                await api.addMatch({ format, teamA, teamB, scoreA, scoreB });
                d().scoreA = d().scoreB = 0;
                saveDraft();
                const winner = scoreA > scoreB ? 'Team A wins' : scoreB > scoreA ? 'Team B wins' : 'Draw';
                toast(`Saved · ${winner} ${scoreA}–${scoreB} (${signed(dA)} / ${signed(-dA)})`);
            } catch (e) { toast(errMsg(e), 'error'); }
        });
        app.render();
    },
};

export const inputs = {
    score(el) {
        const k = el.dataset.side === 'A' ? 'scoreA' : 'scoreB';
        const v = parseInt(el.value, 10);
        d()[k] = isNaN(v) ? 0 : Math.max(0, Math.min(MAX_SCORE, v));
        updateScoreUI();
    },
    pickSearch(el) {
        pickQuery = el.value;
        const list = document.getElementById('pickList');
        if (list) list.innerHTML = pickerList();
    },
};

// Pressing Enter in the picker search picks the top result.
export function onPickerEnter() {
    const first = document.querySelector('#pickList [data-action="choosePlayer"]');
    first?.click();
}

