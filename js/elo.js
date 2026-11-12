import { ELO_DEFAULT, ELO_K, ELO_MIN_GAMES_RANKED } from './config.js';
import { state } from './state.js';

// Ratings are derived by replaying every match chronologically, so edits and
// deletes are always reflected. Results are cached until data changes.
let cache = {};
export const invalidate = () => { cache = {}; };

export const fmtOf = m => m.format || '2v2';
export const expected = (rA, rB) => 1 / (1 + Math.pow(10, (rB - rA) / 400));

export function eloDelta(rA, rB, scoreA, scoreB) {
    const actual = scoreA > scoreB ? 1 : scoreA < scoreB ? 0 : 0.5;
    const dA = Math.round(ELO_K * (actual - expected(rA, rB)));
    return { dA, dB: -dA }; // zero-sum
}

function compute(fmt) {
    const ratings = {}, history = {}, games = {}, deltas = {};
    const r = p => ratings[p] ?? ELO_DEFAULT;
    const apply = (p, d, m) => {
        ratings[p] = r(p) + d;
        games[p] = (games[p] || 0) + 1;
        (history[p] ||= [{ rating: ELO_DEFAULT, matchId: null, date: null }]).push({ rating: ratings[p], matchId: m.id, date: m.date, delta: d });
        (deltas[m.id] ||= {})[p] = d;
    };
    const sorted = state.matches.filter(m => fmtOf(m) === fmt)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const m of sorted) {
        const rA = m.teamA.reduce((s, p) => s + r(p), 0) / m.teamA.length;
        const rB = m.teamB.reduce((s, p) => s + r(p), 0) / m.teamB.length;
        const { dA, dB } = eloDelta(rA, rB, m.scoreA, m.scoreB);
        m.teamA.forEach(p => apply(p, dA, m));
        m.teamB.forEach(p => apply(p, dB, m));
    }
    const players = {};
    for (const p of Object.keys(ratings)) {
        players[p] = { rating: ratings[p], history: history[p], games: games[p], ranked: games[p] >= ELO_MIN_GAMES_RANKED };
    }
    return { players, deltas };
}

export function ratings(fmt = '2v2') {
    return (cache[fmt] ||= compute(fmt)).players;
}

// Elo change per player for a given match: { [player]: delta }
export function matchDeltas(match) {
    const fmt = fmtOf(match);
    return (cache[fmt] ||= compute(fmt)).deltas[match.id] || {};
}

export const ratingOf = (p, fmt = '2v2') => ratings(fmt)[p]?.rating ?? ELO_DEFAULT;
export const teamRating = (team, fmt = '2v2') =>
    Math.round(team.reduce((s, p) => s + ratingOf(p, fmt), 0) / team.length);

export const resultFor = (m, p) => {
    const inA = m.teamA.includes(p);
    const mine = inA ? m.scoreA : m.scoreB, theirs = inA ? m.scoreB : m.scoreA;
    return mine > theirs ? 'w' : mine < theirs ? 'l' : 'd';
};
export const plays = (m, p) => m.teamA.includes(p) || m.teamB.includes(p);

// W/L/D + recent form per player for one format, in one pass.
export function formTable(fmt = '2v2', recent = 5) {
    const t = {};
    for (const m of state.matches) { // newest first
        if (fmtOf(m) !== fmt) continue;
        for (const p of [...m.teamA, ...m.teamB]) {
            const s = (t[p] ||= { w: 0, l: 0, d: 0, form: [] });
            const res = resultFor(m, p);
            s[res]++;
            if (s.form.length < recent) s.form.push(res);
        }
    }
    return t;
}

// Full profile for a player across formats.
export function playerProfile(p) {
    const ms = state.matches.filter(m => plays(m, p));
    let w = 0, l = 0, d = 0, gf = 0, ga = 0, streak = 0, streakType = null;
    const partners = {}, opponents = {};
    for (const m of ms) {
        const inA = m.teamA.includes(p);
        const res = resultFor(m, p);
        if (res === 'w') w++; else if (res === 'l') l++; else d++;
        gf += inA ? m.scoreA : m.scoreB;
        ga += inA ? m.scoreB : m.scoreA;
        if (streakType === null) { streakType = res; streak = 1; }
        else if (streak > 0 && res === streakType) streak++;
        else if (streak > 0) streak = -streak; // freeze (negative marks "ended")
        const mates = (inA ? m.teamA : m.teamB).filter(x => x !== p);
        const opps = inA ? m.teamB : m.teamA;
        for (const x of mates) { const s = (partners[x] ||= { w: 0, n: 0 }); s.n++; if (res === 'w') s.w++; }
        for (const x of opps)  { const s = (opponents[x] ||= { l: 0, n: 0 }); s.n++; if (res === 'l') s.l++; }
    }
    const pick = (obj, score) => Object.entries(obj).filter(([, s]) => s.n >= 2)
        .sort((a, b) => score(b[1]) - score(a[1]) || b[1].n - a[1].n)[0];
    const best = pick(partners, s => s.w / s.n);
    const nemesis = pick(opponents, s => s.l / s.n);
    const played = w + l + d;
    return {
        matches: ms, played, w, l, d, gf, ga,
        winRate: played ? Math.round((w / played) * 100) : 0,
        streak: Math.abs(streak), streakType,
        bestPartner: best ? { name: best[0], ...best[1] } : null,
        nemesis: nemesis && nemesis[1].l > 0 ? { name: nemesis[0], ...nemesis[1] } : null,
        r2: ratings('2v2')[p] || null,
        r1: ratings('1v1')[p] || null,
    };
}
