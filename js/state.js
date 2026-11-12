// Single shared app state. Views read from it; api.js writes to it.
export const state = {
    user: null,          // auth user merged with profile row
    clubs: [],           // [{ club_id, clubs: {...} }]
    club: null,          // active club row
    role: null,          // active user's club_roles row (null = none)
    roles: [],           // club_roles for active club
    members: [],         // club_members + profiles for active club
    matches: [],         // normalised match objects, newest first
    pendingRequests: 0,
    syncing: false,
    syncError: false,
    tab: 'play',
    draft: loadDraft(),
};

function loadDraft() {
    const base = { format: '2v2', slots: ['', '', '', ''], scoreA: 0, scoreB: 0 };
    try {
        const saved = JSON.parse(localStorage.getItem('padel-draft') || 'null');
        if (saved && Array.isArray(saved.slots) && saved.slots.length === 4) {
            return { ...base, format: saved.format === '1v1' ? '1v1' : '2v2', slots: saved.slots.map(s => String(s || '')) };
        }
    } catch { /* ignore */ }
    return base;
}

export function saveDraft() {
    try {
        localStorage.setItem('padel-draft', JSON.stringify({ format: state.draft.format, slots: state.draft.slots }));
    } catch { /* ignore */ }
}

// ─── Identity helpers ─────────────────────────────────────────────────────
// Match rows store player names in UPPERCASE; that string is the player key.
export const memberName = m => m?.profiles?.username || m?.profiles?.display_name || '';
export const keyOf = name => String(name || '').trim().toUpperCase();
export const myKey = () => keyOf(state.user?.username || state.user?.display_name || '');

export function memberByKey(key) {
    return state.members.find(m => keyOf(memberName(m)) === key) || null;
}

// Pretty display for a player key: real username casing if a member, else Title Case.
export function displayName(key) {
    const m = memberByKey(key);
    if (m) return memberName(m);
    return String(key || '').toLowerCase().replace(/(^|[\s\-'])(\S)/g, (_, a, b) => a + b.toUpperCase());
}

export function avatarUrlOf(key) {
    return memberByKey(key)?.profiles?.avatar_url || null;
}

// ─── Permissions ──────────────────────────────────────────────────────────
export const isOwner = () => !!state.club && state.club.owner_id === state.user?.id;
export const myPriority = () => (isOwner() ? 0 : (state.role?.priority ?? Infinity));

export function can(perm) {
    if (!state.club || !state.user) return false;
    if (isOwner()) return true;
    if (state.role) return state.role.permissions?.[perm] === true;
    return perm === 'add_matches'; // members without a role may only add matches
}
