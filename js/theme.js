// ─── THEME (light / dark) ─────────────────────────────────────────────────
const THEME_BG = { dark: '#1a1208', light: '#fff8f0' };

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    // Keep the mobile browser chrome color in sync with the page background
    const meta = document.getElementById('metaThemeColor');
    if (meta) meta.content = THEME_BG[theme] || THEME_BG.light;
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    try { localStorage.setItem('padel-theme', newTheme); } catch { }
}

// ─── TEAM COLORS ──────────────────────────────────────────────────────────
// User-selectable colors for Team A and Team B: light, dark and the classic
// padel court colors (court blue, court green, clay), plus the original
// gold/ocean defaults. Applied app-wide via the --team-a / --team-b tokens.
const TEAM_COLOR_PRESETS = {
    gold:  { label: 'Gold',        color: '#f2c94c', text: '#1a1208' },
    ocean: { label: 'Ocean',       color: '#5b9bd5', text: '#0f2233' },
    light: { label: 'Light',       color: '#f2ede3', text: '#2c1a0a' },
    dark:  { label: 'Dark',        color: '#26221e', text: '#f5ede2' },
    blue:  { label: 'Court Blue',  color: '#1f6f9f', text: '#ffffff' },
    green: { label: 'Court Green', color: '#2e8b57', text: '#ffffff' },
    clay:  { label: 'Clay',        color: '#c8773d', text: '#1a1208' },
};
const TEAM_COLOR_DEFAULTS = { a: 'gold', b: 'ocean' };

let teamColors = { ...TEAM_COLOR_DEFAULTS };

function applyTeamColors() {
    const root = document.documentElement.style;
    ['a', 'b'].forEach(team => {
        const preset = TEAM_COLOR_PRESETS[teamColors[team]] || TEAM_COLOR_PRESETS[TEAM_COLOR_DEFAULTS[team]];
        root.setProperty(`--team-${team}`, preset.color);
        root.setProperty(`--team-${team}-contrast`, preset.text);
    });
}

function setTeamColor(team, key) {
    if (!TEAM_COLOR_PRESETS[key]) return;
    const other = team === 'a' ? 'b' : 'a';
    if (teamColors[other] === key) return; // teams must stay distinguishable
    teamColors[team] = key;
    try { localStorage.setItem('padel-team-colors', JSON.stringify(teamColors)); } catch { }
    applyTeamColors();
    renderTeamColorPickers();
}

function renderTeamColorPickers() {
    [['a', 'teamSwatchesA'], ['b', 'teamSwatchesB']].forEach(([team, elId]) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const other = team === 'a' ? 'b' : 'a';
        el.innerHTML = Object.entries(TEAM_COLOR_PRESETS).map(([key, p]) => `
            <button type="button"
                class="color-swatch${teamColors[team] === key ? ' selected' : ''}"
                style="--sw:${p.color}"
                title="${p.label}"
                aria-label="Team ${team.toUpperCase()}: ${p.label}"
                ${teamColors[other] === key ? 'disabled' : ''}
                onclick="setTeamColor('${team}','${key}')"></button>`).join('');
    });
}

// ─── RESTORE SAVED THEME & TEAM COLORS ────────────────────────────────────
(function () {
    try {
        const saved = localStorage.getItem('padel-theme');
        if (saved) applyTheme(saved);
    } catch { }
    try {
        const saved = JSON.parse(localStorage.getItem('padel-team-colors') || 'null');
        if (saved && TEAM_COLOR_PRESETS[saved.a] && TEAM_COLOR_PRESETS[saved.b] && saved.a !== saved.b) {
            teamColors = { a: saved.a, b: saved.b };
        }
    } catch { }
    applyTeamColors();
})();
