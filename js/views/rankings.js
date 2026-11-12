import { ELO_MIN_GAMES_RANKED } from '../config.js';
import { state, can, myKey, displayName, memberByKey, keyOf } from '../state.js';
import { ratings, formTable, playerProfile, matchDeltas, resultFor } from '../elo.js';
import { esc, icon, avatar, signed, formDots, openSheet, sheetHead, ratingChart, empty, when, plural } from '../ui.js';
import { noClubState } from './club.js';

let fmt = '2v2';

function lastDelta(p) {
    const h = p.history;
    return h.length > 1 ? h[h.length - 1].delta : 0;
}

function podium(top) {
    const order = [top[1], top[0], top[2]];
    return `<div class="podium">${order.map((e, i) => {
        if (!e) return '<div class="pod pod-empty"></div>';
        const [k, p] = e;
        const place = [2, 1, 3][i];
        return `<button class="pod pod-${place}" data-action="openPlayer" data-key="${esc(k)}" data-fmt="${fmt}">
            <span class="pod-av">${avatar(k, place === 1 ? 'xl' : 'lg')}${place === 1 ? `<span class="pod-crown">${icon('crown')}</span>` : ''}</span>
            <span class="pod-name">${esc(displayName(k))}</span>
            <span class="pod-elo">${p.rating}</span>
            <span class="pod-step"><b>${place}</b></span>
        </button>`;
    }).join('')}</div>`;
}

function row(k, p, rank, form) {
    const ld = lastDelta(p);
    const s = form[k] || { w: 0, l: 0, d: 0, form: [] };
    return `<button class="rank-row${k === myKey() ? ' me' : ''}" data-action="openPlayer" data-key="${esc(k)}" data-fmt="${fmt}">
        <span class="rank-n">${rank ?? '–'}</span>
        ${avatar(k, 'md')}
        <span class="row-main"><b>${esc(displayName(k))}${k === myKey() ? ' <em>You</em>' : ''}</b>
            <small>${s.w}W · ${s.l}L${s.d ? ` · ${s.d}D` : ''} ${formDots(s.form)}</small></span>
        <span class="rank-elo"><b>${p.rating}</b><small class="delta ${ld > 0 ? 'up' : ld < 0 ? 'down' : ''}">${ld ? signed(ld) : '—'}</small></span>
    </button>`;
}

export function render() {
    if (!state.club) return noClubState();
    if (!can('view_scores')) return empty('lock', 'Rankings are hidden', 'Your role in this club can’t view scores yet.');
    const r = ratings(fmt);
    const form = formTable(fmt);
    const sorted = Object.entries(r).sort((a, b) => b[1].rating - a[1].rating);
    const ranked = sorted.filter(([, p]) => p.ranked);
    const prov = sorted.filter(([, p]) => !p.ranked);
    const seg = `<div class="seg seg-wide">
        <button class="${fmt === '2v2' ? 'on' : ''}" data-action="rankFmt" data-f="2v2">Doubles</button>
        <button class="${fmt === '1v1' ? 'on' : ''}" data-action="rankFmt" data-f="1v1">Singles</button></div>`;

    if (!sorted.length) {
        return `<div class="page-head"><h1>Ranking</h1></div>${seg}
            ${empty('trophy', 'No rankings yet', `Play ${fmt === '1v1' ? 'singles' : 'doubles'} matches to climb the ladder.`)}`;
    }
    const top = ranked.length >= 3 ? ranked.slice(0, 3) : [];
    const rest = top.length ? ranked.slice(3) : ranked;
    return `
    <div class="page-head"><h1>Ranking</h1><button class="icon-btn" data-action="rankInfo" aria-label="How ranking works">?</button></div>
    ${seg}
    ${top.length ? podium(top) : ''}
    ${rest.length ? `<div class="card list-card">${rest.map(([k, p], i) => row(k, p, i + 1 + top.length, form)).join('')}</div>` : ''}
    ${prov.length ? `<h3 class="month">Provisional · fewer than ${ELO_MIN_GAMES_RANKED} games</h3>
        <div class="card list-card">${prov.map(([k, p]) => row(k, p, null, form)).join('')}</div>` : ''}`;
}

// ─── Player sheet ─────────────────────────────────────────────────────────
function playerSheet(key, pf) {
    const p = playerProfile(key);
    const member = memberByKey(key);
    const role = member ? (member.user_id === state.club?.owner_id ? 'Owner' : member.club_roles?.name || 'Member') : 'Guest';
    const main = pf === '1v1' ? p.r1 : p.r2;
    const rank = (() => {
        const list = Object.entries(ratings(pf)).filter(([, x]) => x.ranked).sort((a, b) => b[1].rating - a[1].rating);
        const i = list.findIndex(([k]) => k === key);
        return i >= 0 ? `#${i + 1} of ${list.length}` : 'Unranked';
    })();
    const stat = (v, l) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`;
    const recent = p.matches.slice(0, 8).map(m => {
        const res = resultFor(m, key);
        const inA = m.teamA.includes(key);
        const mates = (inA ? m.teamA : m.teamB).filter(x => x !== key);
        const opp = inA ? m.teamB : m.teamA;
        const d = matchDeltas(m)[key] ?? 0;
        return `<button class="row row-btn" data-action="openMatch" data-id="${esc(m.id)}">
            <span class="res res-${res}">${res.toUpperCase()}</span>
            <span class="row-main"><b>${inA ? m.scoreA : m.scoreB}–${inA ? m.scoreB : m.scoreA} vs ${opp.map(k => esc(displayName(k))).join(' & ')}</b>
            <small>${mates.length ? `with ${mates.map(k => esc(displayName(k))).join(', ')} · ` : ''}${when(m.date)}</small></span>
            <span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${signed(d)}</span>
        </button>`;
    }).join('');
    const insight = (ic, label, val) => `<div class="insight">${icon(ic)}<span><small>${label}</small><b>${val}</b></span></div>`;
    const peak = main ? Math.max(...main.history.map(h => h.rating)) : null;
    return `${sheetHead('')}
    <div class="profile-hero">
        ${avatar(key, 'xl')}
        <h2>${esc(displayName(key))}</h2>
        <span class="muted">${esc(role)}${key === myKey() ? ' · You' : ''}</span>
    </div>
    ${p.r1 && p.r2 ? `<div class="seg seg-wide">
        <button class="${pf === '2v2' ? 'on' : ''}" data-action="openPlayer" data-key="${esc(key)}" data-fmt="2v2">Doubles</button>
        <button class="${pf === '1v1' ? 'on' : ''}" data-action="openPlayer" data-key="${esc(key)}" data-fmt="1v1">Singles</button></div>` : ''}
    <div class="rating-card">
        <div><small>Rating</small><b>${main?.rating ?? 1200}</b><span class="muted">${main?.ranked ? rank : `Provisional · ${main?.games || 0}/${ELO_MIN_GAMES_RANKED} games`}</span></div>
        ${peak ? `<div class="right"><small>Peak</small><b class="sm">${peak}</b></div>` : ''}
    </div>
    ${ratingChart(main?.history)}
    <div class="stats">${stat(p.played, 'Played')}${stat(p.w, 'Won')}${stat(p.l, 'Lost')}${stat(p.winRate + '%', 'Win rate')}</div>
    <div class="insights">
        ${p.streak >= 2 ? insight('flame', p.streakType === 'w' ? 'Win streak' : p.streakType === 'l' ? 'Losing streak' : 'Draw streak', plural(p.streak, 'match')) : ''}
        ${p.bestPartner ? insight('handshake', 'Best partner', `${esc(displayName(p.bestPartner.name))} · ${p.bestPartner.w}/${p.bestPartner.n} won`) : ''}
        ${p.nemesis ? insight('target', 'Toughest opponent', `${esc(displayName(p.nemesis.name))} · lost ${p.nemesis.l}/${p.nemesis.n}`) : ''}
        ${insight('ball', 'Games for / against', `${p.gf} – ${p.ga}`)}
    </div>
    ${recent ? `<div class="list-label">Recent matches</div><div class="list">${recent}</div>` : ''}`;
}

export const actions = {
    rankFmt(el, app) { fmt = el.dataset.f; app.render(); },
    openPlayer(el) {
        const key = keyOf(el.dataset.key);
        let pf = el.dataset.fmt;
        if (!pf) pf = ratings('2v2')[key] || !ratings('1v1')[key] ? '2v2' : '1v1';
        openSheet('player', () => playerSheet(key, pf));
    },
    rankInfo() {
        openSheet('rankInfo', () => `${sheetHead('How ranking works')}
            <div class="prose">
                <p>Everyone starts at <b>1200</b>. After each match the winners take points from the losers — more for beating a stronger team, fewer for beating a weaker one.</p>
                <p>In doubles, a team's strength is the average of both players, and both partners gain or lose the same amount.</p>
                <p>Doubles and singles have separate ratings. You appear on the ladder after <b>${ELO_MIN_GAMES_RANKED} matches</b>.</p>
                <p class="muted">Elo system · K-factor 32 · draws split the points.</p>
            </div>`);
    },
};

