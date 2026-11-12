import { MAX_SCORE } from '../config.js';
import { state, can, keyOf, myKey, displayName } from '../state.js';
import { matchDeltas, fmtOf, plays } from '../elo.js';
import * as api from '../api.js';
import { esc, icon, avatar, when, monthLabel, signed, toast, errMsg, openSheet, closeSheet, sheetHead, confirmDialog, busy, empty } from '../ui.js';
import { noClubState } from './club.js';

let filter = 'all';

const names = team => team.map(k => esc(displayName(k))).join(' & ');
const stack = team => `<span class="av-stack">${team.map(k => avatar(k, 'xs')).join('')}</span>`;

export function matchCard(m) {
    const winA = m.scoreA > m.scoreB, winB = m.scoreB > m.scoreA;
    const me = myKey();
    const deltas = matchDeltas(m);
    const mine = plays(m, me) ? deltas[me] : undefined;
    const row = (team, score, win) => `
        <div class="mc-row${win ? ' win' : ''}">
            ${stack(team)}
            <span class="mc-names">${names(team)}</span>
            <span class="mc-score">${score}</span>
        </div>`;
    return `<article class="match" data-action="openMatch" data-id="${esc(m.id)}" tabindex="0">
        ${row(m.teamA, m.scoreA, winA)}
        ${row(m.teamB, m.scoreB, winB)}
        <footer class="mc-foot">
            <span>${when(m.date)}</span>
            ${fmtOf(m) === '1v1' ? '<span class="pill">Singles</span>' : ''}
            ${mine !== undefined ? `<span class="delta ${mine > 0 ? 'up' : mine < 0 ? 'down' : ''}">You ${signed(mine)}</span>` : ''}
        </footer>
    </article>`;
}

export function render() {
    if (!state.club) return noClubState();
    if (!can('view_scores')) return empty('lock', 'Scores are hidden', 'Your role in this club can’t view match history yet. Ask an admin.');
    const me = myKey();
    const list = state.matches.filter(m =>
        filter === 'all' ? true : filter === 'mine' ? plays(m, me) : fmtOf(m) === filter);
    const chips = [['all', 'All'], ['mine', 'Mine'], ['2v2', 'Doubles'], ['1v1', 'Singles']]
        .map(([k, l]) => `<button class="chip${filter === k ? ' on' : ''}" data-action="matchFilter" data-f="${k}">${l}</button>`).join('');

    let body;
    if (!state.matches.length) {
        body = empty('ball', 'No matches yet', 'Record your first game and it shows up here.',
            `<button class="btn btn-primary" data-action="tab" data-tab="play">${icon('plus')}New match</button>`);
    } else if (!list.length) {
        body = empty('search', 'Nothing here', 'No matches match this filter.');
    } else {
        let month = '', html = '';
        for (const m of list) {
            const ml = monthLabel(m.date);
            if (ml !== month) { if (month) html += '</div>'; html += `<h3 class="month">${ml}</h3><div class="stack">`; month = ml; }
            html += matchCard(m);
        }
        body = html + '</div>';
    }
    return `
    <div class="page-head">
        <h1>Matches</h1>
        <span class="muted">${state.matches.length} played</span>
    </div>
    <div class="chips">${chips}</div>
    ${body}`;
}

// ─── Match detail sheet ───────────────────────────────────────────────────
function detail(id) {
    const m = state.matches.find(x => x.id === id);
    if (!m) return `${sheetHead('Match')}<p class="hint">This match no longer exists.</p>`;
    const deltas = matchDeltas(m);
    const winA = m.scoreA > m.scoreB, winB = m.scoreB > m.scoreA;
    const side = (team, win, label) => `
        <div class="md-side${win ? ' win' : ''}">
            <span class="md-label">${label}${win ? ' · Winner' : ''}</span>
            ${team.map(k => `
                <button class="row row-btn" data-action="openPlayer" data-key="${esc(k)}">
                    ${avatar(k, 'md')}
                    <span class="row-main"><b>${esc(displayName(k))}</b></span>
                    <span class="delta ${deltas[k] > 0 ? 'up' : deltas[k] < 0 ? 'down' : ''}">${signed(deltas[k] ?? 0)}</span>
                </button>`).join('')}
        </div>`;
    const canEdit = can('modify_matches'), canDel = can('delete_matches');
    return `${sheetHead(fmtOf(m) === '1v1' ? 'Singles match' : 'Doubles match', esc(new Date(m.date).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })))}
        <div class="md-score"><span class="${winA ? 'win' : ''}">${m.scoreA}</span><i>–</i><span class="${winB ? 'win' : ''}">${m.scoreB}</span></div>
        ${side(m.teamA, winA, 'Team A')}
        ${side(m.teamB, winB, 'Team B')}
        ${canEdit || canDel ? `<div class="btn-row">
            ${canDel ? `<button class="btn btn-ghost btn-danger-text" data-action="deleteMatch" data-id="${esc(m.id)}">${icon('trash')}Delete</button>` : ''}
            ${canEdit ? `<button class="btn btn-secondary" data-action="editMatch" data-id="${esc(m.id)}">${icon('edit')}Edit</button>` : ''}
        </div>` : ''}`;
}

function editForm(id) {
    const m = state.matches.find(x => x.id === id);
    if (!m) return sheetHead('Edit match');
    const is1 = fmtOf(m) === '1v1';
    const dt = new Date(m.date), pad = n => String(n).padStart(2, '0');
    const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    const known = [...new Set(state.matches.flatMap(x => [...x.teamA, ...x.teamB]))].sort();
    const p = (name, v, label) => `<label class="field"><span>${label}</span><input class="input" name="${name}" value="${esc(v || '')}" list="knownPlayers" autocomplete="off" required></label>`;
    return `${sheetHead('Edit match')}
    <form class="form" data-form="editMatch" data-id="${esc(m.id)}">
        <datalist id="knownPlayers">${known.map(k => `<option value="${esc(k)}">`).join('')}</datalist>
        <div class="form-grid">
            <div class="form-col"><h4 class="ta">Team A</h4>${p('a1', m.teamA[0], 'Player')}${is1 ? '' : p('a2', m.teamA[1], 'Partner')}
                <label class="field"><span>Games</span><input class="input" name="sa" type="number" inputmode="numeric" min="0" max="${MAX_SCORE}" value="${m.scoreA}" required></label></div>
            <div class="form-col"><h4 class="tb">Team B</h4>${p('b1', m.teamB[0], 'Player')}${is1 ? '' : p('b2', m.teamB[1], 'Partner')}
                <label class="field"><span>Games</span><input class="input" name="sb" type="number" inputmode="numeric" min="0" max="${MAX_SCORE}" value="${m.scoreB}" required></label></div>
        </div>
        <label class="field"><span>Date & time</span><input class="input" name="date" type="datetime-local" value="${local}" required></label>
        <div class="btn-row">
            <button type="button" class="btn btn-ghost" data-action="closeSheet">Cancel</button>
            <button class="btn btn-primary">Save changes</button>
        </div>
    </form>`;
}

export const actions = {
    matchFilter(el, app) { filter = el.dataset.f; app.render(); },
    openMatch(el) { const id = el.dataset.id; openSheet('match', () => detail(id)); },
    editMatch(el) {
        if (!can('modify_matches')) return;
        const id = el.dataset.id;
        openSheet('editMatch', () => editForm(id), { live: false });
    },
    async deleteMatch(el, app) {
        if (!(await confirmDialog({ title: 'Delete this match?', message: 'Ratings will be recalculated. This can’t be undone.', confirm: 'Delete', danger: true }))) return;
        try {
            await api.deleteMatch(el.dataset.id);
            closeSheet('match');
            toast('Match deleted');
            app.render();
        } catch (e) { toast(errMsg(e), 'error'); }
    },
};

export const forms = {
    async editMatch(form, app) {
        const m = state.matches.find(x => x.id === form.dataset.id);
        if (!m) return;
        const f = new FormData(form);
        const is1 = fmtOf(m) === '1v1';
        const teamA = (is1 ? [f.get('a1')] : [f.get('a1'), f.get('a2')]).map(keyOf);
        const teamB = (is1 ? [f.get('b1')] : [f.get('b1'), f.get('b2')]).map(keyOf);
        const scoreA = parseInt(f.get('sa'), 10), scoreB = parseInt(f.get('sb'), 10);
        if ([...teamA, ...teamB].some(x => !x)) return toast('Fill in all players', 'error');
        if (new Set([...teamA, ...teamB]).size !== teamA.length + teamB.length) return toast('A player can only appear once', 'error');
        if ([scoreA, scoreB].some(v => isNaN(v) || v < 0 || v > MAX_SCORE)) return toast(`Scores must be 0–${MAX_SCORE}`, 'error');
        const date = f.get('date') ? new Date(f.get('date')).toISOString() : m.date;
        await busy(form.querySelector('.btn-primary'), async () => {
            try {
                await api.updateMatch({ ...m, teamA, teamB, scoreA, scoreB, date });
                closeSheet('editMatch');
                toast('Match updated');
                app.render();
            } catch (e) { toast(errMsg(e), 'error'); }
        });
    },
};
