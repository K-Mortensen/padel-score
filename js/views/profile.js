import { state, myKey } from '../state.js';
import { ratings } from '../elo.js';
import * as api from '../api.js';
import { esc, icon, avatar, toast, errMsg, openSheet, closeSheet, sheetHead, confirmDialog, busy } from '../ui.js';

// ─── Theme ────────────────────────────────────────────────────────────────
const THEME_KEY = 'padel-theme';
export function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
}
export function applyTheme(t = getTheme()) {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1220' : '#f3f5f8');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());

function sheet() {
    const u = state.user;
    const key = myKey();
    const r2 = ratings('2v2')[key], r1 = ratings('1v1')[key];
    const t = getTheme();
    const themeBtn = (v, ic, l) => `<button class="${t === v ? 'on' : ''}" data-action="setTheme" data-t="${v}">${icon(ic)}${l}</button>`;
    return `${sheetHead('Profile')}
    <div class="profile-hero">
        ${avatar(key, 'xl', u.avatar_url || null)}
        <h2>${esc(u.username || u.display_name)}</h2>
        <span class="muted">${esc(u.email || '')}</span>
    </div>
    ${state.club ? `<div class="stats">
        <div class="stat"><b>${r2?.rating ?? '—'}</b><small>Doubles</small></div>
        <div class="stat"><b>${r1?.rating ?? '—'}</b><small>Singles</small></div>
        <div class="stat"><b>${(r2?.games || 0) + (r1?.games || 0)}</b><small>Matches</small></div>
    </div>
    <button class="btn btn-secondary btn-block" data-action="openPlayer" data-key="${esc(key)}">${icon('trophy')}View my stats</button>` : ''}

    <form class="form" data-form="rename">
        <label class="field"><span>Username</span>
        <div class="input-row"><input class="input" name="username" value="${esc(u.username || '')}" minlength="2" maxlength="24" required autocomplete="off">
        <button class="btn btn-secondary">Save</button></div>
        <small class="field-hint">Renaming keeps your match history and rating.</small></label>
    </form>

    <div class="field"><span class="field-label">Appearance</span>
        <div class="seg seg-wide seg-icons">${themeBtn('system', 'monitor', 'Auto')}${themeBtn('light', 'sun', 'Light')}${themeBtn('dark', 'moon', 'Dark')}</div></div>

    <div class="card list-card">
        ${state.club ? `<button class="row row-btn" data-action="exportData">${icon('download')}<span class="row-main"><b>Export matches</b><small>Download ${esc(state.club.name)} as JSON</small></span></button>` : ''}
        <button class="row row-btn danger" data-action="signOut">${icon('logout')}<span class="row-main"><b>Sign out</b></span></button>
    </div>`;
}

export const actions = {
    openProfile() { openSheet('profile', sheet, { live: false }); },
    setTheme(el) {
        try { localStorage.setItem(THEME_KEY, el.dataset.t); } catch { /* ignore */ }
        applyTheme(el.dataset.t);
        el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
    },
    exportData() {
        const data = {
            club: state.club?.name,
            exportedAt: new Date().toISOString(),
            matches: state.matches,
            ratings: {
                doubles: Object.fromEntries(Object.entries(ratings('2v2')).map(([k, v]) => [k, v.rating])),
                singles: Object.fromEntries(Object.entries(ratings('1v1')).map(([k, v]) => [k, v.rating])),
            },
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: `${(state.club?.name || 'padel').replace(/\W+/g, '-').toLowerCase()}-matches.json` });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    async signOut(el, app) {
        if (!(await confirmDialog({ title: 'Sign out?', confirm: 'Sign out' }))) return;
        await api.signOut();
        location.reload();
    },
};

export const forms = {
    async rename(form, app) {
        const name = new FormData(form).get('username').trim();
        if (name.length < 2) return toast('Username must be at least 2 characters', 'error');
        if (name === state.user.username) return;
        await busy(form.querySelector('button'), async () => {
            try { await api.renameUsername(name); toast('Username updated'); closeSheet('profile'); app.render(); }
            catch (e) { toast(errMsg(e), 'error'); }
        });
    },
};
