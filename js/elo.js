// ─── ELO ENGINE ───────────────────────────────────────────────────────────
// Computes Elo ratings by replaying all matches in chronological order.
// Returns { [playerName]: { rating, history: [{rating, matchId, delta, date}], gamesPlayed } }

// ── Cache ──────────────────────────────────────────────────────────────────
let _eloCache = {};
function invalidateEloCache() { _eloCache = {}; }

// ── Shared delta helper ────────────────────────────────────────────────────
function computeEloDelta(rA, rB, scoreA, scoreB) {
    const expA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
    let actA;
    if (scoreA > scoreB) actA = 1;
    else if (scoreA < scoreB) actA = 0;
    else actA = 0.5;
    const dA = Math.round(ELO_K * (actA - expA));
    const dB = -dA; // ensure zero-sum (independent rounding can leak Elo)
    return { dA, dB };
}

function computeElo(matches, format) {
    // format: '2v2' or '1v1'. If undefined, compute for all matches (legacy).
    const filteredMatches = format
        ? matches.filter(m => (m.format || '2v2') === format)
        : matches;

    const ratings = {};
    const history = {};
    const gamesPlayed = {};

    function getR(p) { return ratings[p] ?? ELO_DEFAULT; }

    // ISO date strings sort correctly as plain strings — no Date construction needed
    const sorted = [...filteredMatches].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    function applyUpdate(p, delta, m) {
        ratings[p] = getR(p) + delta;
        gamesPlayed[p] = (gamesPlayed[p] || 0) + 1;
        if (!history[p]) history[p] = [{ rating: ELO_DEFAULT, matchId: null, delta: 0, date: null }];
        history[p].push({ rating: ratings[p], matchId: m.id, delta, date: m.date });
    }

    sorted.forEach(m => {
        const is1v1 = (m.format || '2v2') === '1v1';

        if (is1v1) {
            const [a1] = m.teamA;
            const [b1] = m.teamB;
            const { dA, dB } = computeEloDelta(getR(a1), getR(b1), m.scoreA, m.scoreB);
            applyUpdate(a1, dA, m);
            applyUpdate(b1, dB, m);
        } else {
            const [a1, a2, b1, b2] = [...m.teamA, ...m.teamB];
            const rA = (getR(a1) + getR(a2)) / 2;
            const rB = (getR(b1) + getR(b2)) / 2;
            const { dA, dB } = computeEloDelta(rA, rB, m.scoreA, m.scoreB);
            [a1, a2].forEach(p => applyUpdate(p, dA, m));
            [b1, b2].forEach(p => applyUpdate(p, dB, m));
        }
    });

    const result = {};
    Object.keys(ratings).forEach(p => {
        result[p] = {
            rating: ratings[p],
            history: history[p] || [{ rating: ELO_DEFAULT }],
            gamesPlayed: gamesPlayed[p] || 0,
        };
    });
    return result;
}

function getEloRatings(format) {
    const fmt = format || '2v2';
    if (!_eloCache[fmt]) _eloCache[fmt] = computeElo(appData.matches, fmt);
    return _eloCache[fmt];
}

function getElo1v1Ratings() {
    return getEloRatings('1v1');
}

function getPlayerElo(name, format) {
    return getEloRatings(format || '2v2')[name]?.rating ?? ELO_DEFAULT;
}

function getTeamElo(team, format) {
    return Math.round(team.reduce((s, p) => s + getPlayerElo(p, format || '2v2'), 0) / team.length);
}
