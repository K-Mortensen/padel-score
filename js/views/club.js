import { VISIBILITY, PERM_LABELS, ALL_PERMS } from '../config.js';
import { state, can, isOwner, myPriority, keyOf, memberName } from '../state.js';
import { ratings, formTable } from '../elo.js';
import * as api from '../api.js';
import { esc, icon, avatar, toast, errMsg, openSheet, closeSheet, sheetHead, confirmDialog, promptDialog, busy, empty, plural, when } from '../ui.js';

const visIcon = v => (v === 'public' ? 'globe' : v === 'private' ? 'lock' : 'mail');
export const inviteLink = code => `${location.origin}${location.pathname}?invite=${encodeURIComponent(code)}`;

// ─── Shared create / join form markup ─────────────────────────────────────
export function createJoinForms() {
    const vis = Object.entries(VISIBILITY).map(([k, v], i) => `
        <label class="radio-card"><input type="radio" name="visibility" value="${k}" ${i === 1 ? 'checked' : ''}>
            <span>${icon(visIcon(k))}<b>${v.label}</b><small>${v.hint}</small></span></label>`).join('');
    return `
    <form class="form" data-form="joinClub">
        <label class="field"><span>Have an invite code?</span>
            <div class="input-row"><input class="input input-code" name="code" placeholder="ABC123" maxlength="12" autocomplete="off" required>
            <button class="btn btn-primary">Join</button></div></label>
    </form>
    <div class="or"><span>or create a new club</span></div>
    <form class="form" data-form="createClub">
        <label class="field"><span>Club name</span><input class="input" name="name" placeholder="e.g. Aarhus Padel Crew" maxlength="40" required></label>
        <div class="radio-cards">${vis}</div>
        <button class="btn btn-secondary btn-block">${icon('plus')}Create club</button>
    </form>
    <button class="btn btn-ghost btn-block" data-action="browseClubs">${icon('search')}Browse public clubs</button>`;
}

export function noClubState() {
    return `<div class="welcome card">
        <div class="welcome-art">${icon('users')}</div>
        <h2>Join your padel crew</h2>
        <p class="muted">Matches and rankings live inside a club. Join one with an invite code or start your own.</p>
        ${createJoinForms()}
    </div>`;
}

// ─── Club tab ─────────────────────────────────────────────────────────────
export function render() {
    if (!state.club) return noClubState();
    const c = state.club;
    const r = ratings('2v2');
    const form = formTable('2v2');
    const members = [...state.members].sort((a, b) => {
        const oa = a.user_id === c.owner_id, ob = b.user_id === c.owner_id;
        if (oa !== ob) return oa ? -1 : 1;
        return (r[keyOf(memberName(b))]?.rating ?? 1200) - (r[keyOf(memberName(a))]?.rating ?? 1200);
    });
    const canManage = isOwner() || can('manage_roles') || can('kick_members') || can('approve_requests');
    const v = VISIBILITY[c.visibility] || VISIBILITY.public_invite;
    const memberRows = members.map(m => {
        const k = keyOf(memberName(m));
        const s = form[k] || { w: 0, l: 0, d: 0 };
        const played = s.w + s.l + s.d;
        const owner = m.user_id === c.owner_id;
        return `<button class="row row-btn" data-action="openPlayer" data-key="${esc(k)}">
            ${avatar(k, 'md', m.profiles?.avatar_url || null)}
            <span class="row-main"><b>${esc(memberName(m))}${m.user_id === state.user.id ? ' <em>You</em>' : ''}</b>
            <small>${owner ? `${icon('crown', 'i-xs')} Owner` : esc(m.club_roles?.name || 'Member')} · ${plural(played, 'match')}</small></span>
            <span class="rank-elo"><b>${r[k]?.rating ?? 1200}</b><small>rating</small></span>
        </button>`;
    }).join('');

    return `
    <section class="club-hero">
        <div class="club-hero-top">
            <span class="club-badge">${esc(c.name.slice(0, 2).toUpperCase())}</span>
            <div><h1>${esc(c.name)}</h1>
            <span class="club-meta">${icon(visIcon(c.visibility), 'i-xs')} ${v.label} · ${plural(state.members.length, 'member')} · ${plural(state.matches.length, 'match')}</span></div>
        </div>
        <div class="invite">
            <div><small>Invite code</small><b class="code">${esc(c.invite_code || '—')}</b></div>
            <button class="btn btn-on-dark" data-action="copyInvite">${icon('copy')}Copy</button>
            <button class="btn btn-accent" data-action="shareInvite">${icon('share')}Invite</button>
        </div>
    </section>

    ${state.pendingRequests ? `<button class="banner" data-action="openManage" data-tab="requests">
        ${icon('userplus')}<span><b>${plural(state.pendingRequests, 'join request')}</b><small>Tap to review</small></span>${icon('right')}</button>` : ''}

    <section class="section">
        <div class="section-head"><h2>Members</h2>
            ${canManage ? `<button class="link" data-action="openManage">${icon('sliders')}Manage</button>` : ''}</div>
        <div class="card list-card">${memberRows || '<p class="hint">No members found</p>'}</div>
    </section>

    <section class="section">
        <div class="section-head"><h2>Clubs</h2></div>
        <div class="card list-card">
            <button class="row row-btn" data-action="openClubSwitcher">${icon('swap')}<span class="row-main"><b>Switch club</b><small>${plural(state.clubs.length, 'club')} joined</small></span>${icon('right')}</button>
            <button class="row row-btn" data-action="browseClubs">${icon('search')}<span class="row-main"><b>Find a club</b><small>Browse public clubs</small></span>${icon('right')}</button>
            <button class="row row-btn" data-action="openNewClub">${icon('plus')}<span class="row-main"><b>Create or join</b><small>New club or invite code</small></span>${icon('right')}</button>
            ${isOwner() ? `<button class="row row-btn" data-action="openClubSettings">${icon('sliders')}<span class="row-main"><b>Club settings</b><small>Name, visibility, ownership</small></span>${icon('right')}</button>` : ''}
            ${!isOwner() ? `<button class="row row-btn danger" data-action="leaveClub">${icon('logout')}<span class="row-main"><b>Leave club</b></span></button>` : ''}
        </div>
    </section>`;
}

// ─── Club switcher ────────────────────────────────────────────────────────
function switcherSheet() {
    return `${sheetHead('Your clubs')}
    <div class="list">${state.clubs.map(m => {
        const c = m.clubs, cur = c.id === state.club?.id;
        return `<button class="row row-btn${cur ? ' current' : ''}" data-action="switchClub" data-id="${esc(c.id)}">
            <span class="club-badge sm">${esc(c.name.slice(0, 2).toUpperCase())}</span>
            <span class="row-main"><b>${esc(c.name)}</b><small>${VISIBILITY[c.visibility]?.label || ''}${c.owner_id === state.user.id ? ' · Owner' : ''}</small></span>
            ${cur ? icon('check', 'i-primary') : ''}</button>`;
    }).join('') || '<p class="hint">You haven’t joined any clubs yet.</p>'}</div>
    <div class="btn-row">
        <button class="btn btn-ghost" data-action="browseClubs">${icon('search')}Browse</button>
        <button class="btn btn-secondary" data-action="openNewClub">${icon('plus')}New / join</button>
    </div>`;
}

// ─── Browse ───────────────────────────────────────────────────────────────
let browseData = null, browseQuery = '';
function browseList() {
    if (!browseData) return '<div class="loader"><span class="spinner"></span></div>';
    const q = browseQuery.trim().toLowerCase();
    const list = browseData.filter(c => !q || c.name.toLowerCase().includes(q));
    if (!list.length) return '<p class="hint">No clubs found</p>';
    const mine = new Set(state.clubs.map(m => m.club_id));
    return list.map(c => {
        let action;
        if (c.id === state.club?.id) action = '<span class="tag">Current</span>';
        else if (mine.has(c.id)) action = `<button class="btn btn-sm btn-ghost" data-action="switchClub" data-id="${esc(c.id)}">Open</button>`;
        else if (c.visibility === 'public') action = `<button class="btn btn-sm btn-primary" data-action="joinPublic" data-id="${esc(c.id)}">Join</button>`;
        else if (c.requested) action = '<span class="tag">Requested</span>';
        else if (c.visibility === 'public_invite') action = `<button class="btn btn-sm btn-secondary" data-action="requestJoin" data-id="${esc(c.id)}">Request</button>`;
        else action = `<button class="btn btn-sm btn-ghost" data-action="joinWithCode">Use code</button>`;
        return `<div class="row">
            <span class="club-badge sm">${esc(c.name.slice(0, 2).toUpperCase())}</span>
            <span class="row-main"><b>${esc(c.name)}</b><small>${icon(visIcon(c.visibility), 'i-xs')} ${VISIBILITY[c.visibility]?.label || ''} · ${plural(c.memberCount, 'member')}</small></span>
            ${action}</div>`;
    }).join('');
}
const browseSheet = () => `${sheetHead('Find a club')}
    <div class="search">${icon('search')}<input class="input" placeholder="Search clubs" value="${esc(browseQuery)}" data-input="browseSearch" autocomplete="off"></div>
    <div class="list" id="browseList">${browseList()}</div>`;
const refreshBrowse = () => { const el = document.getElementById('browseList'); if (el) el.innerHTML = browseList(); };

// ─── Manage (members / roles / requests) ──────────────────────────────────
let manageTab = 'members', requests = null, roleEditing = undefined;

function manageMembers() {
    const mine = myPriority();
    const canKick = can('kick_members');
    const canRoles = can('manage_roles');
    const rows = state.members.map(m => {
        const owner = m.user_id === state.club.owner_id, self = m.user_id === state.user.id;
        const theirs = m.club_roles?.priority ?? Infinity;
        const assignable = state.roles.filter(r => (r.priority ?? 99) > mine);
        let control;
        if (owner) control = `<span class="tag">${icon('crown', 'i-xs')}Owner</span>`;
        else if (self || !canRoles || theirs <= mine) control = `<span class="tag">${esc(m.club_roles?.name || 'No role')}</span>`;
        else control = `<select class="select select-sm" data-change="assignRole" data-user="${esc(m.user_id)}">
            <option value="">No role</option>${assignable.map(r => `<option value="${esc(r.id)}" ${m.role_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`;
        const kick = canKick && !owner && !self && theirs > mine
            ? `<button class="icon-btn danger" data-action="kick" data-user="${esc(m.user_id)}" data-name="${esc(memberName(m))}" aria-label="Remove">${icon('x')}</button>` : '';
        return `<div class="row">${avatar(keyOf(memberName(m)), 'sm', m.profiles?.avatar_url || null)}
            <span class="row-main"><b>${esc(memberName(m))}${self ? ' <em>You</em>' : ''}</b></span>${control}${kick}</div>`;
    }).join('');
    return `<div class="list">${rows}</div>
    ${isOwner() ? `<label class="field"><span>Default role for new members</span>
        <select class="select" data-change="defaultRole"><option value="">No role (can add matches only)</option>
        ${state.roles.map(r => `<option value="${esc(r.id)}" ${state.club.default_role_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>` : ''}`;
}

function manageRoles() {
    const mine = myPriority();
    if (roleEditing !== undefined) {
        const r = roleEditing ? state.roles.find(x => x.id === roleEditing) : null;
        const def = isOwner() ? 50 : Math.min(mine + 5, 98);
        return `<form class="form" data-form="saveRole" data-id="${esc(r?.id || '')}">
            <label class="field"><span>Role name</span><input class="input" name="name" value="${esc(r?.name || '')}" placeholder="e.g. Scorer" required maxlength="30"></label>
            <label class="field"><span>Rank (lower number = more authority)</span><input class="input" name="priority" type="number" min="${Number.isFinite(mine) ? mine + 1 : 1}" max="98" value="${r?.priority ?? def}" required></label>
            <div class="checks">${ALL_PERMS.map(p => `<label class="check"><input type="checkbox" name="perm" value="${p}" ${r?.permissions?.[p] ? 'checked' : ''}><span>${PERM_LABELS[p]}</span></label>`).join('')}</div>
            <div class="btn-row"><button type="button" class="btn btn-ghost" data-action="roleCancel">Cancel</button><button class="btn btn-primary">${r ? 'Save role' : 'Create role'}</button></div>
        </form>`;
    }
    const canEditRoles = can('manage_roles');
    return `<div class="list">${state.roles.map(r => {
        const perms = ALL_PERMS.filter(p => r.permissions?.[p]).map(p => PERM_LABELS[p]);
        const manageable = canEditRoles && (r.priority ?? 99) > mine;
        return `<div class="row role-row">
            <span class="role-rank">${r.priority ?? '–'}</span>
            <span class="row-main"><b>${esc(r.name)}</b><small>${perms.length ? esc(perms.join(' · ')) : 'No permissions'}</small></span>
            ${manageable ? `<button class="icon-btn" data-action="roleEdit" data-id="${esc(r.id)}" aria-label="Edit">${icon('edit')}</button>
            <button class="icon-btn danger" data-action="roleDelete" data-id="${esc(r.id)}" data-name="${esc(r.name)}" aria-label="Delete">${icon('trash')}</button>` : ''}
        </div>`;
    }).join('') || '<p class="hint">No roles yet</p>'}</div>
    ${canEditRoles ? `<button class="btn btn-secondary btn-block" data-action="roleEdit" data-id="">${icon('plus')}New role</button>` : ''}`;
}

function manageRequests() {
    if (!requests) return '<div class="loader"><span class="spinner"></span></div>';
    if (!requests.length) return empty('userplus', 'No pending requests', 'People who ask to join show up here.');
    return `<div class="list">${requests.map(r => {
        const n = r.profile?.username || r.profile?.display_name || 'Unknown player';
        return `<div class="row">${avatar(keyOf(n), 'md', r.profile?.avatar_url || null)}
            <span class="row-main"><b>${esc(n)}</b><small>Requested ${when(r.created_at)}</small></span>
            <button class="btn btn-sm btn-ghost" data-action="declineReq" data-id="${esc(r.id)}">Decline</button>
            <button class="btn btn-sm btn-primary" data-action="approveReq" data-id="${esc(r.id)}">Approve</button></div>`;
    }).join('')}</div>`;
}

function manageSheet() {
    const tabs = [['members', 'Members'], ['roles', 'Roles']];
    if (api.canApprove()) tabs.push(['requests', `Requests${state.pendingRequests ? ` <i class="badge">${state.pendingRequests}</i>` : ''}`]);
    return `${sheetHead('Manage club', esc(state.club.name))}
    <div class="seg seg-wide">${tabs.map(([k, l]) => `<button class="${manageTab === k ? 'on' : ''}" data-action="manageTab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${manageTab === 'roles' ? manageRoles() : manageTab === 'requests' ? manageRequests() : manageMembers()}`;
}

async function loadRequestsIntoSheet() {
    requests = null;
    try { requests = await api.loadRequests(); } catch (e) { requests = []; toast(errMsg(e), 'error'); }
    openSheet('manage', manageSheet, { wide: true });
}

// ─── Club settings (owner) ────────────────────────────────────────────────
function settingsSheet() {
    const c = state.club;
    return `${sheetHead('Club settings')}
    <form class="form" data-form="renameClub">
        <label class="field"><span>Club name</span><div class="input-row"><input class="input" name="name" value="${esc(c.name)}" maxlength="40" required><button class="btn btn-secondary">Save</button></div></label>
    </form>
    <div class="field"><span class="field-label">Who can find this club</span>
        <div class="radio-cards">${Object.entries(VISIBILITY).map(([k, v]) => `
            <label class="radio-card"><input type="radio" name="vis" value="${k}" data-change="visibility" ${c.visibility === k ? 'checked' : ''}>
            <span>${icon(visIcon(k))}<b>${v.label}</b><small>${v.hint}</small></span></label>`).join('')}</div></div>
    <div class="danger-zone">
        <h4>Danger zone</h4>
        <button class="row row-btn" data-action="openTransfer">${icon('crown')}<span class="row-main"><b>Transfer ownership</b><small>Hand the club to another member and leave</small></span>${icon('right')}</button>
        <button class="row row-btn danger" data-action="deleteClub">${icon('trash')}<span class="row-main"><b>Delete club</b><small>Removes all matches and members for good</small></span></button>
    </div>`;
}

function transferSheet() {
    const others = state.members.filter(m => m.user_id !== state.user.id);
    return `${sheetHead('Transfer ownership', 'You’ll leave the club afterwards')}
    <div class="list">${others.map(m => `<button class="row row-btn" data-action="transferTo" data-user="${esc(m.user_id)}" data-name="${esc(memberName(m))}">
        ${avatar(keyOf(memberName(m)), 'md', m.profiles?.avatar_url || null)}<span class="row-main"><b>${esc(memberName(m))}</b><small>${esc(m.club_roles?.name || 'Member')}</small></span>${icon('right')}</button>`).join('')
        || '<p class="hint">No other members to transfer to.</p>'}</div>`;
}

// ─── Actions ──────────────────────────────────────────────────────────────
async function afterClubChange(app, msg) {
    closeSheet('switcher'); closeSheet('browse'); closeSheet('newClub');
    window.scrollTo({ top: 0 });
    await app.reload();
    if (msg) toast(msg);
}

export async function joinByCode(code, app) {
    const club = await api.findClubByCode(code);
    const already = state.clubs.some(m => m.club_id === club.id);
    await api.joinClub(club);
    await afterClubChange(app, already ? `Switched to ${club.name}` : `Welcome to ${club.name}!`);
}

export const actions = {
    openClubSwitcher() { openSheet('switcher', switcherSheet); },
    openNewClub() { openSheet('newClub', () => `${sheetHead('Create or join a club')}${createJoinForms()}`, { live: false }); },
    async switchClub(el, app) {
        if (el.dataset.id === state.club?.id) return closeSheet('switcher');
        await busy(el, async () => {
            await api.selectClub(el.dataset.id);
            await afterClubChange(app, `Switched to ${state.club.name}`);
        });
    },
    async browseClubs() {
        browseData = null; browseQuery = '';
        openSheet('browse', browseSheet, { live: false });
        try { browseData = await api.browseClubs(); } catch (e) { browseData = []; toast(errMsg(e), 'error'); }
        refreshBrowse();
    },
    async joinPublic(el, app) {
        const club = browseData?.find(c => c.id === el.dataset.id);
        if (!club) return;
        await busy(el, async () => {
            try { await api.joinClub(club); await afterClubChange(app, `Welcome to ${club.name}!`); }
            catch (e) { toast(errMsg(e), 'error'); }
        });
    },
    async requestJoin(el) {
        await busy(el, async () => {
            try {
                await api.requestMembership(el.dataset.id);
                const c = browseData.find(x => x.id === el.dataset.id); if (c) c.requested = true;
                refreshBrowse(); toast('Request sent — an admin will review it');
            } catch (e) { toast(errMsg(e), 'error'); }
        });
    },
    async joinWithCode(el, app) {
        const code = await promptDialog({ title: 'Enter invite code', placeholder: 'ABC123', confirm: 'Join', upper: true });
        if (!code) return;
        try { await joinByCode(code, app); } catch (e) { toast(errMsg(e), 'error'); }
    },
    async copyInvite() {
        const code = state.club?.invite_code;
        if (!code) return;
        try { await navigator.clipboard.writeText(code); toast('Invite code copied'); }
        catch { await promptDialog({ title: 'Invite code', value: code, confirm: 'Done' }); }
    },
    async shareInvite() {
        const c = state.club; if (!c?.invite_code) return;
        const url = inviteLink(c.invite_code);
        const text = `Join ${c.name} on Firematch and track our padel matches. Code: ${c.invite_code}`;
        if (navigator.share) { try { await navigator.share({ title: c.name, text, url }); } catch { /* cancelled */ } return; }
        try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Invite link copied'); }
        catch { await promptDialog({ title: 'Invite link', value: url, confirm: 'Done' }); }
    },
    async leaveClub(el, app) {
        if (!(await confirmDialog({ title: `Leave ${state.club.name}?`, message: 'Your matches stay in the club history.', confirm: 'Leave', danger: true }))) return;
        try { const n = state.club.name; await api.leaveClub(); await afterClubChange(app, `You left ${n}`); }
        catch (e) { toast(errMsg(e), 'error'); }
    },

    // manage
    async openManage(el) {
        manageTab = el?.dataset?.tab || 'members'; roleEditing = undefined;
        openSheet('manage', manageSheet, { wide: true });
        if (manageTab === 'requests') loadRequestsIntoSheet();
    },
    manageTab(el) {
        manageTab = el.dataset.tab; roleEditing = undefined;
        openSheet('manage', manageSheet, { wide: true });
        if (manageTab === 'requests') loadRequestsIntoSheet();
    },
    async kick(el, app) {
        if (!(await confirmDialog({ title: `Remove ${el.dataset.name}?`, message: 'They can rejoin with the invite code.', confirm: 'Remove', danger: true }))) return;
        try { await api.kickMember(el.dataset.user); toast(`${el.dataset.name} removed`); app.render(); }
        catch (e) { toast(errMsg(e), 'error'); }
    },
    roleEdit(el) { roleEditing = el.dataset.id || null; openSheet('manage', manageSheet, { wide: true }); },
    roleCancel() { roleEditing = undefined; openSheet('manage', manageSheet, { wide: true }); },
    async roleDelete(el, app) {
        if (!(await confirmDialog({ title: `Delete “${el.dataset.name}”?`, message: 'Members with this role become unassigned.', confirm: 'Delete', danger: true }))) return;
        try { await api.deleteRole(el.dataset.id); toast('Role deleted'); app.render(); }
        catch (e) { toast(errMsg(e), 'error'); }
    },
    async approveReq(el, app) {
        await busy(el, async () => {
            try { await api.approveRequest(el.dataset.id); requests = requests.filter(r => r.id !== el.dataset.id); toast('Request approved'); app.render(); }
            catch (e) { toast(errMsg(e), 'error'); }
        });
    },
    async declineReq(el, app) {
        await busy(el, async () => {
            try { await api.declineRequest(el.dataset.id); requests = requests.filter(r => r.id !== el.dataset.id); toast('Request declined'); app.render(); }
            catch (e) { toast(errMsg(e), 'error'); }
        });
    },

    // owner settings
    openClubSettings() { openSheet('clubSettings', settingsSheet, { live: false }); },
    openTransfer() { openSheet('transfer', transferSheet); },
    async transferTo(el, app) {
        const name = el.dataset.name;
        if (!(await confirmDialog({ title: `Make ${name} the owner?`, message: `You’ll leave ${esc(state.club.name)} after the transfer.`, confirm: 'Transfer & leave', danger: true }))) return;
        try {
            const club = state.club.name;
            await api.transferOwnership(el.dataset.user);
            await api.leaveClub();
            closeSheet('transfer'); closeSheet('clubSettings');
            await afterClubChange(app, `${name} now owns ${club}`);
        } catch (e) { toast(errMsg(e), 'error'); }
    },
    async deleteClub(el, app) {
        const name = state.club.name;
        if (!(await confirmDialog({ title: 'Delete club?', message: 'All matches, roles and memberships are permanently removed.', confirm: 'Delete forever', danger: true, requireText: name }))) return;
        try { await api.deleteClub(); closeSheet('clubSettings'); await afterClubChange(app, `${name} deleted`); }
        catch (e) { toast(errMsg(e), 'error'); }
    },
};

export const changes = {
    async assignRole(el, app) {
        try { await api.assignRole(el.dataset.user, el.value); toast('Role updated'); app.render(); }
        catch (e) { toast(errMsg(e), 'error'); }
    },
    async defaultRole(el) {
        try { await api.setDefaultRole(el.value); toast('Default role saved'); }
        catch (e) { toast(errMsg(e), 'error'); }
    },
    async visibility(el, app) {
        try { await api.setVisibility(el.value); toast(`Club is now ${VISIBILITY[el.value].label.toLowerCase()}`); app.render(); }
        catch (e) { toast(errMsg(e), 'error'); }
    },
};

export const inputs = {
    browseSearch(el) { browseQuery = el.value; refreshBrowse(); },
};

export const forms = {
    async joinClub(form, app) {
        const code = new FormData(form).get('code')?.trim();
        if (!code) return;
        await busy(form.querySelector('button'), async () => {
            try { await joinByCode(code, app); } catch (e) { toast(errMsg(e), 'error'); }
        });
    },
    async createClub(form, app) {
        const f = new FormData(form);
        const name = f.get('name')?.trim();
        if (!name) return;
        await busy(form.querySelector('button'), async () => {
            try { await api.createClub(name, f.get('visibility') || 'public_invite'); await afterClubChange(app, `${name} created — invite your friends!`); app.go('club'); }
            catch (e) { toast(errMsg(e), 'error'); }
        });
    },
    async saveRole(form, app) {
        const f = new FormData(form);
        const name = f.get('name').trim();
        const priority = parseInt(f.get('priority'), 10);
        const mine = myPriority();
        if (!name) return;
        if (isNaN(priority) || priority <= mine) return toast(`Rank must be greater than ${mine}`, 'error');
        const chosen = new Set(f.getAll('perm'));
        const permissions = Object.fromEntries(ALL_PERMS.map(p => [p, chosen.has(p)]));
        await busy(form.querySelector('.btn-primary'), async () => {
            try { await api.saveRole(form.dataset.id || null, name, permissions, priority); roleEditing = undefined; toast('Role saved'); openSheet('manage', manageSheet, { wide: true }); app.render(); }
            catch (e) { toast(errMsg(e), 'error'); }
        });
    },
    async renameClub(form, app) {
        const name = new FormData(form).get('name').trim();
        if (!name || name === state.club.name) return;
        await busy(form.querySelector('button'), async () => {
            try { await api.renameClub(name); toast('Club renamed'); app.render(); }
            catch (e) { toast(errMsg(e), 'error'); }
        });
    },
};
