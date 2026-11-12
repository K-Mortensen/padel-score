import { displayName, avatarUrlOf } from './state.js';

// ─── Escaping & formatting ────────────────────────────────────────────────
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function when(iso) {
    const d = new Date(iso), now = new Date();
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today - day) / 86400000);
    if (diff === 0) return `Today · ${time}`;
    if (diff === 1) return `Yesterday · ${time}`;
    if (diff < 7) return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} · ${time}`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
export const monthLabel = iso => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');
export const plural = (n, word) => `${n} ${n === 1 ? word : /(ch|sh|s|x)$/.test(word) ? word + 'es' : word + 's'}`;

// ─── Icons (24×24 stroke icons) ───────────────────────────────────────────
const P = {
    ball: '<circle cx="12" cy="12" r="9.5"/><path d="M5.2 5.5c3.4 3.4 3.4 9.6 0 13M18.8 5.5c-3.4 3.4-3.4 9.6 0 13"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>',
    shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4M2 6h1.9c1.5 0 2.9.9 3.6 2.2M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8M18 14l4 4-4 4"/>',
    scale: '<path d="M12 3v18M5 7h14M8 21h8"/><path d="m5 7-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.4 6.4L3 16M3 12a9 9 0 0 1 15.4-6.4L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    crown: '<path d="m2 6 4 11h12l4-11-6 5-4-7-4 7z"/><path d="M6 21h12"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    swap: '<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4"/>',
    userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.4.3 1.4 1.4 2.9 2.5 2.9z"/>',
    handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a3 3 0 0 0-4.2 0l-.9.9a1 1 0 1 1-3-3l2.8-2.8a5.8 5.8 0 0 1 7.1-.9l.5.3a2 2 0 0 0 1.4.2L21 4"/><path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
};
export const icon = (name, cls = '') =>
    `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export const googleLogo = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>`;

// ─── Avatars ──────────────────────────────────────────────────────────────
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
export function initials(name) {
    const parts = String(name || '?').trim().split(/[\s_\-.]+/).filter(Boolean);
    return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase();
}
// key = player key (uppercase name). Uses member avatar if available.
export function avatar(key, size = 'md', urlOverride) {
    const name = displayName(key);
    const url = urlOverride !== undefined ? urlOverride : avatarUrlOf(key);
    const style = `--h:${hue(String(key).toUpperCase())}`;
    const txt = size === 'xs' ? initials(name)[0] : initials(name);
    if (url) return `<span class="av av-${size}" style="${style}"><img src="${esc(url)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()"><b>${esc(txt)}</b></span>`;
    return `<span class="av av-${size}" style="${style}"><b>${esc(txt)}</b></span>`;
}

// ─── Toasts ───────────────────────────────────────────────────────────────
export function toast(msg, type = 'ok') {
    const host = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `${icon(type === 'error' ? 'x' : 'check')}<span>${esc(msg)}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, type === 'error' ? 4500 : 2600);
}
export const errMsg = e => (e?.code === '23505' ? 'That name is already taken.' : e?.message || 'Something went wrong.');

// ─── Bottom sheets ────────────────────────────────────────────────────────
// openSheet(id, render, opts): render() returns inner HTML. Sheets stack.
// live sheets are re-rendered on refreshSheets() (after data changes).
const stack = [];
export const sheetOpen = id => stack.some(s => s.id === id);

export function openSheet(id, render, { live = true, onClose, wide = false } = {}) {
    const existing = stack.find(s => s.id === id);
    if (existing && existing === stack.at(-1)) { existing.render = render; existing.live = live; paint(existing); return existing; }
    if (existing) { // bring to front: drop the old instance without animation
        stack.splice(stack.indexOf(existing), 1);
        existing.el.remove();
    }
    const el = document.createElement('div');
    el.className = 'sheet-backdrop';
    el.innerHTML = `<section class="sheet${wide ? ' sheet-wide' : ''}" role="dialog" aria-modal="true"><div class="sheet-grip" aria-hidden="true"></div><div class="sheet-body"></div></section>`;
    document.getElementById('sheets').appendChild(el);
    const entry = { id, el, render, live, onClose };
    stack.push(entry);
    paint(entry);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
    el.addEventListener('mousedown', e => { if (e.target === el) closeSheet(id); });
    enableSwipe(entry);
    const first = el.querySelector('[autofocus]');
    if (first && matchMedia('(hover: hover)').matches) setTimeout(() => first.focus(), 250);
    return entry;
}

function paint(s) { s.el.querySelector('.sheet-body').innerHTML = s.render(); }

export function rerenderSheet(id) { const s = stack.find(x => x.id === id); if (s) paint(s); }
export function refreshSheets() { stack.filter(s => s.live).forEach(paint); }

export function closeSheet(id) {
    const i = id ? stack.findIndex(s => s.id === id) : stack.length - 1;
    if (i < 0) return;
    const [s] = stack.splice(i, 1);
    s.el.classList.remove('open');
    setTimeout(() => s.el.remove(), 280);
    if (!stack.length) document.body.classList.remove('no-scroll');
    s.onClose?.();
}
export function closeAllSheets() { while (stack.length) closeSheet(); }

function enableSwipe(entry) {
    const sheet = entry.el.querySelector('.sheet');
    let y0 = null, dy = 0;
    sheet.addEventListener('touchstart', e => {
        const onGrip = e.target.closest('.sheet-grip, .sheet-head');
        if (!onGrip && sheet.scrollTop > 0) return;
        if (e.target.closest('input, select, textarea, button')) return;
        y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    sheet.addEventListener('touchmove', e => {
        if (y0 === null) return;
        dy = Math.max(0, e.touches[0].clientY - y0);
        if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
        if (y0 === null) return;
        sheet.style.transform = '';
        if (dy > 110) closeSheet(entry.id);
        y0 = null;
    });
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) closeSheet(); });

export const sheetHead = (title, sub = '') => `
    <header class="sheet-head">
        <div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
        <button class="icon-btn" data-action="closeSheet" aria-label="Close">${icon('x')}</button>
    </header>`;

// ─── Dialogs (promise based) ──────────────────────────────────────────────
let dlgSeq = 0;
export function confirmDialog({ title, message = '', confirm = 'Confirm', danger = false, requireText = null }) {
    return new Promise(resolve => {
        const id = 'dlg' + (++dlgSeq);
        let done = false;
        const finish = v => { if (done) return; done = true; closeSheet(id); resolve(v); };
        openSheet(id, () => `
            <div class="dialog">
                <h2>${esc(title)}</h2>
                ${message ? `<p class="muted">${message}</p>` : ''}
                ${requireText ? `<label class="field"><span>Type <b>${esc(requireText)}</b> to confirm</span><input class="input" data-dlg-input autocomplete="off" autofocus></label>` : ''}
                <div class="btn-row">
                    <button class="btn btn-ghost" data-dlg="no">Cancel</button>
                    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-dlg="yes" ${requireText ? 'disabled' : ''}>${esc(confirm)}</button>
                </div>
            </div>`, { live: false, onClose: () => finish(false) });
        const el = stack.find(s => s.id === id).el;
        el.addEventListener('click', e => {
            const b = e.target.closest('[data-dlg]');
            if (b && !b.disabled) finish(b.dataset.dlg === 'yes');
        });
        if (requireText) {
            el.querySelector('[data-dlg-input]').addEventListener('input', e => {
                el.querySelector('[data-dlg="yes"]').disabled = e.target.value.trim().toUpperCase() !== requireText.trim().toUpperCase();
            });
        }
    });
}

export function promptDialog({ title, message = '', placeholder = '', value = '', confirm = 'OK', upper = false }) {
    return new Promise(resolve => {
        const id = 'dlg' + (++dlgSeq);
        let done = false;
        const finish = v => { if (done) return; done = true; closeSheet(id); resolve(v); };
        openSheet(id, () => `
            <form class="dialog" data-dlg-form>
                <h2>${esc(title)}</h2>
                ${message ? `<p class="muted">${message}</p>` : ''}
                <input class="input${upper ? ' input-code' : ''}" data-dlg-input placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off" autofocus>
                <div class="btn-row">
                    <button type="button" class="btn btn-ghost" data-dlg="no">Cancel</button>
                    <button class="btn btn-primary">${esc(confirm)}</button>
                </div>
            </form>`, { live: false, onClose: () => finish(null) });
        const el = stack.find(s => s.id === id).el;
        el.querySelector('[data-dlg="no"]').addEventListener('click', () => finish(null));
        el.querySelector('form').addEventListener('submit', e => {
            e.preventDefault();
            const v = el.querySelector('[data-dlg-input]').value.trim();
            finish(v || null);
        });
    });
}

// ─── Busy buttons ─────────────────────────────────────────────────────────
export async function busy(btn, fn) {
    if (!btn) return fn();
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    btn.classList.add('is-busy');
    btn.disabled = true;
    try { return await fn(); }
    finally { delete btn.dataset.busy; btn.classList.remove('is-busy'); btn.disabled = false; }
}

// ─── Small chart ──────────────────────────────────────────────────────────
export function ratingChart(history) {
    if (!history || history.length < 3) return `<div class="chart-empty">Play a few more matches to see your rating trend</div>`;
    const pts = history.slice(-40).map(h => h.rating);
    const W = 320, H = 96, pad = 6;
    const min = Math.min(...pts) - 8, max = Math.max(...pts) + 8, range = max - min || 1;
    const xy = pts.map((r, i) => [pad + (i / (pts.length - 1)) * (W - pad * 2), pad + (1 - (r - min) / range) * (H - pad * 2)]);
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
    const area = `${line}L${xy.at(-1)[0].toFixed(1)},${H}L${xy[0][0].toFixed(1)},${H}Z`;
    const [lx, ly] = xy.at(-1);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Rating history">
        <defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--primary)" stop-opacity=".28"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#cg)"/>
        <path d="${line}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <circle cx="${lx}" cy="${ly}" r="4" fill="var(--primary)" stroke="var(--surface)" stroke-width="2" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

// form is newest-first; render oldest → newest so the latest result sits on the right
export const formDots = form => `<span class="formdots">${[...form].reverse().map(r => `<i class="f-${r}" title="${r === 'w' ? 'Win' : r === 'l' ? 'Loss' : 'Draw'}"></i>`).join('')}</span>`;

export const empty = (ic, title, text = '', action = '') => `
    <div class="empty">
        <div class="empty-icon">${icon(ic)}</div>
        <h3>${title}</h3>
        ${text ? `<p>${text}</p>` : ''}
        ${action}
    </div>`;
