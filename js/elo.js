// ─── ELO ENGINE ───────────────────────────────────────────────────────────
// Computes Elo ratings by replaying all matches in chronological order.
// Returns { [playerName]: { rating, history: [{rating, matchId, delta, date}], gamesPlayed } }

function computeElo(matches) {
  const ratings     = {};
  const history     = {};
  const gamesPlayed = {};

  function getR(p) { return ratings[p] ?? ELO_DEFAULT; }

  const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(m => {
    const [a1, a2, b1, b2] = [...m.teamA, ...m.teamB];
    const rA = (getR(a1) + getR(a2)) / 2;
    const rB = (getR(b1) + getR(b2)) / 2;

    const expA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
    const expB = 1 - expA;

    let actA, actB;
    if      (m.scoreA > m.scoreB) { actA = 1;   actB = 0;   }
    else if (m.scoreA < m.scoreB) { actA = 0;   actB = 1;   }
    else                          { actA = 0.5; actB = 0.5; }

    const dA = Math.round(ELO_K * (actA - expA));
    const dB = Math.round(ELO_K * (actB - expB));

    [a1, a2].forEach(p => {
      ratings[p] = getR(p) + dA;
      gamesPlayed[p] = (gamesPlayed[p] || 0) + 1;
      if (!history[p]) history[p] = [{ rating: ELO_DEFAULT, matchId: null, delta: 0, date: null }];
      history[p].push({ rating: ratings[p], matchId: m.id, delta: dA, date: m.date });
    });
    [b1, b2].forEach(p => {
      ratings[p] = getR(p) + dB;
      gamesPlayed[p] = (gamesPlayed[p] || 0) + 1;
      if (!history[p]) history[p] = [{ rating: ELO_DEFAULT, matchId: null, delta: 0, date: null }];
      history[p].push({ rating: ratings[p], matchId: m.id, delta: dB, date: m.date });
    });
  });

  const result = {};
  Object.keys(ratings).forEach(p => {
    result[p] = {
      rating:      ratings[p],
      history:     history[p] || [{ rating: ELO_DEFAULT }],
      gamesPlayed: gamesPlayed[p] || 0,
    };
  });
  return result;
}

function getEloRatings() { return computeElo(appData.matches); }

function getPlayerElo(name) {
  return getEloRatings()[name]?.rating ?? ELO_DEFAULT;
}

function getTeamElo(team) {
  return Math.round(team.reduce((s, p) => s + getPlayerElo(p), 0) / team.length);
}
