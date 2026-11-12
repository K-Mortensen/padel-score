import { sb } from './config.js';
import { state, myKey } from './state.js';
import * as api from './api.js';
import { esc, icon, avatar, toast, errMsg, googleLogo, closeSheet, closeAllSheets, refreshSheets, confirmDialog, busy } from './ui.js';
import * as play from './views/play.js';
import * as matches from './views/matches.js';
import * as rankings from './views/rankings.js';
import * as club from './views/club.js';
import * as profile from './views/profile.js';

profile.applyTheme();

// ─── Invite links (?invite=CODE) survive the OAuth redirect via sessionStorage
(() => {
    const url = new URL(location.href);
    const inv = url.searchParams.get('invite');
    if (!inv) return;
    try { sessionStorage.setItem('padel-invite', inv.toUpperCase()); } catch { /* ignore */ }
    url.searchParams.delete('invite');
    history.replaceState({}, '', url);
})();
const popInvite = () => {
    try { const c = sessionStorage.getItem('padel-invite'); sessionStorage.removeItem('padel-invite'); return c; } catch { return null; }
};

// ─── Tabs & routing ───────────────────────────────────────────────────────
const TABS = {
    play:     { label: 'Play',     icon: 'ball',   view: play },
    matches:  { label: 'Matches',  icon: 'list',   view: matches },
    ranking:  { label: 'Ranking',  icon: 'trophy', view: rankings },
    club:     { label: 'Club',     icon: 'users',  view: club },
};
const tabFromHash = () => (TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'play');

const $ = id => document.getElementById(id);
let lastSync = 0;

export const app = {
    render() {
        state.tab = tabFromHash();
        renderChrome();
        const view = $('view');
        view.innerHTML = TABS[state.tab].view.render();
        refreshSheets();
    },
    go(tab) {
        if (location.hash.slice(1) !== tab) location.hash = tab;
        else app.render();
        window.scrollTo({ top: 0 });
    },
    // Reload everything for the active club.
    async reload({ quiet = false } = {}) {
        state.syncing = true; state.syncError = false;
        renderChrome();
        try {
            await Promise.all([api.loadMatches(), api.refreshRequestCount()]);
            lastSync = Date.now();
        } catch (e) {
            state.syncError = true;
            if (!quiet) toast('Could not load matches — check your connection', 'error');
            console.error(e);
        }
        state.syncing = false;
        play.seedDraft();
        app.render();
    },
};
window.addEventListener('hashchange', () => { closeAllSheets(); app.render(); });

function renderChrome() {
    const top = $('topbar');
    if (!top) return;
    const c = state.club;
    top.innerHTML = `
        <button class="club-switch" data-action="${c ? 'openClubSwitcher' : 'tab'}" data-tab="club">
            <span class="logo-mark sm" aria-hidden="true"></span>
            <span class="club-switch-name">${esc(c?.name || 'Firematch')}</span>
            ${c ? icon('down', 'i-sm') : ''}
        </button>
        <div class="top-actions">
            ${c ? `<button class="icon-btn${state.syncing ? ' spin' : ''}${state.syncError ? ' warn' : ''}" data-action="refresh" aria-label="Refresh">${icon('refresh')}</button>` : ''}
            <button class="me-btn" data-action="openProfile" aria-label="Profile">
                ${avatar(myKey(), 'sm', state.user?.avatar_url || null)}
                ${state.pendingRequests ? `<i class="dot"></i>` : ''}
            </button>
        </div>`;
    $('nav').innerHTML = Object.entries(TABS).map(([k, t]) => `
        <a href="#${k}" class="nav-item${state.tab === k ? ' on' : ''}" ${state.tab === k ? 'aria-current="page"' : ''}>
            ${icon(t.icon)}<span>${t.label}</span>
            ${k === 'club' && state.pendingRequests ? `<i class="badge">${state.pendingRequests}</i>` : ''}
        </a>`).join('');
}

// ─── Auth screens ─────────────────────────────────────────────────────────
function showScreen(name) {
    $('splash').hidden = true;
    $('auth').hidden = name === 'app';
    $('shell').hidden = name !== 'app';
    if (name === 'login') {
        $('auth').innerHTML = `
        <div class="auth-card">
            <div class="brand"><span class="logo-mark lg" aria-hidden="true"></span><h1>Firematch</h1></div>
            <p class="auth-lead">Record padel matches in seconds. Fair teams, live rankings, bragging rights.</p>
            <ul class="auth-points">
                <li>${icon('scale')}<span>Balanced teams from everyone's rating</span></li>
                <li>${icon('trophy')}<span>Club ladder for doubles and singles</span></li>
                <li>${icon('users')}<span>Invite friends with a single link</span></li>
            </ul>
            <button class="btn btn-google btn-lg btn-block" data-action="signIn">${googleLogo}Continue with Google</button>
        </div>`;
    } else if (name === 'username') {
        const suggestion = (state.user?.display_name || '').split(' ')[0] || '';
        $('auth').innerHTML = `
        <form class="auth-card" data-form="username">
            <div class="brand"><span class="logo-mark lg" aria-hidden="true"></span></div>
            <h2>What should we call you?</h2>
            <p class="auth-lead">This is the name on the scoreboard. You can change it later.</p>
            <input class="input input-lg" name="username" value="${esc(suggestion)}" placeholder="Username" minlength="2" maxlength="24" required autocomplete="off" autofocus>
            <button class="btn btn-primary btn-lg btn-block">Continue</button>
        </form>`;
    }
}

async function enterApp() {
    await api.loadClubs();
    showScreen('app');
    app.render();
    if (state.club) await app.reload();
    else play.seedDraft();
    const invite = popInvite();
    if (invite) handleInvite(invite);
}

async function handleInvite(code) {
    try {
        const c = await api.findClubByCode(code);
        if (state.clubs.some(m => m.club_id === c.id)) {
            if (state.club?.id !== c.id) { await api.selectClub(c.id); await app.reload(); }
            return;
        }
        if (await confirmDialog({ title: `Join ${c.name}?`, message: 'You were invited to this club.', confirm: 'Join club' })) {
            await club.joinByCode(code, app);
            app.go('club');
        }
    } catch (e) { toast(errMsg(e), 'error'); }
}

// ─── Global actions ───────────────────────────────────────────────────────
const actions = {
    ...play.actions, ...matches.actions, ...rankings.actions, ...club.actions, ...profile.actions,
    tab(el) { closeAllSheets(); app.go(el.dataset.tab); },
    closeSheet() { closeSheet(); },
    refresh(el) { return app.reload(); },
    async signIn(el) {
        await busy(el, async () => {
            const { error } = await api.signInWithGoogle();
            if (error) toast(error.message, 'error');
            else await new Promise(r => setTimeout(r, 4000)); // keep spinner while redirecting
        });
    },
};
const forms = {
    ...matches.forms, ...club.forms, ...profile.forms,
    async username(form) {
        const name = new FormData(form).get('username').trim();
        if (name.length < 2) return toast('At least 2 characters please', 'error');
        await busy(form.querySelector('button'), async () => {
            try { await api.setUsername(name); await enterApp(); }
            catch (e) { toast(errMsg(e), 'error'); }
        });
    },
};
const inputs = { ...play.inputs, ...club.inputs };
const changes = { ...club.changes };

document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    Promise.resolve(fn(el, app)).catch(err => { console.error(err); toast(errMsg(err), 'error'); });
});
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('[data-action][tabindex]')) e.target.click();
    if (e.key === 'Enter' && e.target.matches('[data-input="pickSearch"]')) { e.preventDefault(); play.onPickerEnter(); }
});
document.addEventListener('submit', e => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const fn = forms[form.dataset.form];
    if (fn) Promise.resolve(fn(form, app)).catch(err => { console.error(err); toast(errMsg(err), 'error'); });
});
document.addEventListener('input', e => {
    const fn = inputs[e.target.dataset?.input];
    if (fn) fn(e.target, app);
});
document.addEventListener('change', e => {
    const fn = changes[e.target.dataset?.change];
    if (fn) Promise.resolve(fn(e.target, app)).catch(err => toast(errMsg(err), 'error'));
});
// Select the score when tapping it so typing replaces the value.
document.addEventListener('focusin', e => { if (e.target.matches('.score-input')) e.target.select(); });

// Refresh when coming back to the app after a while.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.club && Date.now() - lastSync > 60_000 && !state.syncing) app.reload({ quiet: true });
});

// ─── Boot ─────────────────────────────────────────────────────────────────
(async function boot() {
    try {
        const user = await api.getSessionUser();
        if (!user) return showScreen('login');
        const prof = await api.loadProfile(user);
        state.user = prof ? { ...user, ...prof } : user;
        if (!state.user.username) return showScreen('username');
        await enterApp();
    } catch (e) {
        console.error(e);
        $('splash').innerHTML = `<div class="auth-card"><h2>Can’t reach the server</h2><p class="auth-lead">Check your connection and try again.</p>
            <button class="btn btn-primary btn-block" onclick="location.reload()">${icon('refresh')}Retry</button></div>`;
    }
})();

// Sign-outs from another tab
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && state.user) location.reload(); });
