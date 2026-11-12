// All Supabase access lives here. Table/column names match the existing schema
// in supabase/migrations — nothing about stored data changes.
import { sb, DEFAULT_ROLES } from './config.js';
import { state, can, memberName } from './state.js';
import { invalidate } from './elo.js';

const CLUB_KEY = 'padel-club-id';
const unwrap = ({ data, error }) => { if (error) throw error; return data; };

// ─── Auth & profile ───────────────────────────────────────────────────────
export async function getSessionUser() {
    const { data: { session } } = await sb.auth.getSession();
    return session?.user || null;
}

export function signInWithGoogle() {
    return sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
    });
}

export async function signOut() {
    await sb.auth.signOut();
    try { localStorage.removeItem(CLUB_KEY); } catch { /* ignore */ }
}

export async function loadProfile(user) {
    await sb.from('profiles').upsert({
        id: user.id,
        display_name: user.user_metadata?.full_name || user.email.split('@')[0],
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
    }, { onConflict: 'id', ignoreDuplicates: true });

    for (let i = 0; i < 3; i++) {
        const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
        if (data) return data;
        await new Promise(r => setTimeout(r, 500));
    }
    return null;
}

export async function setUsername(username) {
    unwrap(await sb.from('profiles').update({ username }).eq('id', state.user.id));
    state.user.username = username;
}

// Renames the profile AND every match entry atomically so Elo history survives.
export async function renameUsername(newName) {
    const old = state.user.username;
    unwrap(await sb.rpc('update_username_and_matches', { new_username: newName }));
    const oldKey = String(old || '').toUpperCase(), newKey = newName.toUpperCase();
    for (const m of state.matches) {
        m.teamA = m.teamA.map(n => (n === oldKey ? newKey : n));
        m.teamB = m.teamB.map(n => (n === oldKey ? newKey : n));
    }
    state.draft.slots = state.draft.slots.map(n => (n === oldKey ? newKey : n));
    state.user.username = newName;
    const me = state.members.find(m => m.user_id === state.user.id);
    if (me?.profiles) me.profiles.username = newName;
    invalidate();
}

// ─── Clubs ────────────────────────────────────────────────────────────────
export async function loadClubs() {
    const { data } = await sb.from('club_members').select('club_id, clubs(*)').eq('user_id', state.user.id);
    state.clubs = (data || []).filter(m => m.clubs);
    let saved = null;
    try { saved = localStorage.getItem(CLUB_KEY); } catch { /* ignore */ }
    const found = state.clubs.find(m => m.club_id === saved) || state.clubs[0];
    await selectClub(found?.club_id || null);
}

export async function selectClub(clubId) {
    const m = state.clubs.find(c => c.club_id === clubId);
    state.club = m ? m.clubs : null;
    state.role = null; state.roles = []; state.members = []; state.matches = []; state.pendingRequests = 0;
    invalidate();
    try {
        if (state.club) localStorage.setItem(CLUB_KEY, state.club.id);
        else localStorage.removeItem(CLUB_KEY);
    } catch { /* ignore */ }
    if (!state.club) return;
    await Promise.all([loadMyRole(), loadRoles(), loadMembers()]);
}

function patchClub(fields) {
    state.club = { ...state.club, ...fields };
    state.clubs = state.clubs.map(m => (m.club_id === state.club.id ? { ...m, clubs: state.club } : m));
}

export async function createClub(name, visibility) {
    const club = unwrap(await sb.from('clubs').insert({ name, owner_id: state.user.id, visibility }).select().single());
    unwrap(await sb.from('club_members').insert({ club_id: club.id, user_id: state.user.id }));
    await sb.from('club_roles').insert(DEFAULT_ROLES.map(r => ({ club_id: club.id, ...r })));
    state.clubs = [...state.clubs, { club_id: club.id, clubs: club }];
    await selectClub(club.id);
    return club;
}

export async function findClubByCode(code) {
    const { data, error } = await sb.rpc('get_club_by_invite_code', { code: code.trim().toUpperCase() });
    if (error || !data?.[0]) throw new Error('No club found for that invite code.');
    return data[0];
}

export async function joinClub(club) {
    if (!state.clubs.some(m => m.club_id === club.id)) {
        unwrap(await sb.from('club_members').insert({
            club_id: club.id, user_id: state.user.id, role_id: club.default_role_id || null,
        }));
        state.clubs = [...state.clubs, { club_id: club.id, clubs: club }];
    }
    await selectClub(club.id);
}

export async function leaveClub() {
    const id = state.club.id;
    unwrap(await sb.from('club_members').delete().eq('club_id', id).eq('user_id', state.user.id));
    state.clubs = state.clubs.filter(m => m.club_id !== id);
    await selectClub(state.clubs[0]?.club_id || null);
}

export async function deleteClub() {
    const id = state.club.id;
    unwrap(await sb.from('clubs').delete().eq('id', id));
    state.clubs = state.clubs.filter(m => m.club_id !== id);
    await selectClub(state.clubs[0]?.club_id || null);
}

export async function transferOwnership(userId) {
    unwrap(await sb.from('clubs').update({ owner_id: userId }).eq('id', state.club.id));
    patchClub({ owner_id: userId });
    await loadMyRole();
}

export async function renameClub(name) {
    unwrap(await sb.from('clubs').update({ name }).eq('id', state.club.id));
    patchClub({ name });
}

export async function setVisibility(visibility) {
    unwrap(await sb.from('clubs').update({ visibility }).eq('id', state.club.id));
    patchClub({ visibility });
}

export async function setDefaultRole(roleId) {
    const data = unwrap(await sb.from('clubs').update({ default_role_id: roleId || null }).eq('id', state.club.id).select().single());
    patchClub({ default_role_id: data.default_role_id });
}

// Clubs visible to the user (RLS: public + invite-only + own) with member counts.
export async function browseClubs() {
    const [{ data: clubs }, { data: reqs }] = await Promise.all([
        sb.from('clubs').select('id, name, visibility, owner_id, invite_code, default_role_id').order('name'),
        sb.from('club_membership_requests').select('club_id').eq('user_id', state.user.id).eq('status', 'pending'),
    ]);
    if (!clubs?.length) return [];
    const { data: rows } = await sb.from('club_members').select('club_id').in('club_id', clubs.map(c => c.id));
    const count = {};
    (rows || []).forEach(r => { count[r.club_id] = (count[r.club_id] || 0) + 1; });
    const pending = new Set((reqs || []).map(r => r.club_id));
    return clubs.map(c => ({ ...c, memberCount: count[c.id] || 0, requested: pending.has(c.id) }));
}

export async function requestMembership(clubId) {
    unwrap(await sb.from('club_membership_requests').insert({ club_id: clubId, user_id: state.user.id }));
}

// ─── Roles & members ──────────────────────────────────────────────────────
export async function loadMyRole() {
    state.role = null;
    if (!state.club) return;
    const { data } = await sb.from('club_members').select('role_id, club_roles(*)')
        .eq('club_id', state.club.id).eq('user_id', state.user.id).maybeSingle();
    state.role = data?.club_roles || null;
}

export async function loadRoles() {
    const { data, error } = await sb.from('club_roles').select('*')
        .eq('club_id', state.club.id).order('created_at', { ascending: true });
    if (!error) state.roles = (data || []).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

export async function loadMembers() {
    const { data: members, error } = await sb.from('club_members')
        .select('user_id, role_id, club_roles(id, name, priority)').eq('club_id', state.club.id);
    if (error || !members?.length) { state.members = []; return; }
    // profiles fetched separately — works with the restrictive profiles RLS
    const { data: profiles } = await sb.from('profiles')
        .select('id, username, display_name, avatar_url').in('id', members.map(m => m.user_id));
    const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    state.members = members.map(m => ({ ...m, profiles: byId[m.user_id] || null }))
        .filter(m => memberName(m));
}

export async function saveRole(roleId, name, permissions, priority) {
    if (roleId) {
        unwrap(await sb.from('club_roles').update({ name, permissions, priority }).eq('id', roleId).eq('club_id', state.club.id));
    } else {
        unwrap(await sb.from('club_roles').insert({ club_id: state.club.id, name, permissions, priority }).select().single());
    }
    await loadRoles();
}

export async function deleteRole(roleId) {
    unwrap(await sb.from('club_roles').delete().eq('id', roleId).eq('club_id', state.club.id));
    await Promise.all([loadRoles(), loadMembers()]);
}

export async function assignRole(userId, roleId) {
    unwrap(await sb.from('club_members').update({ role_id: roleId || null }).eq('club_id', state.club.id).eq('user_id', userId));
    await loadMembers();
}

export async function kickMember(userId) {
    unwrap(await sb.from('club_members').delete().eq('club_id', state.club.id).eq('user_id', userId));
    state.members = state.members.filter(m => m.user_id !== userId);
}

// ─── Membership requests ──────────────────────────────────────────────────
export const canApprove = () => !!state.club && can('approve_requests');

export async function refreshRequestCount() {
    if (!canApprove()) { state.pendingRequests = 0; return; }
    const { count } = await sb.from('club_membership_requests').select('id', { count: 'exact', head: true })
        .eq('club_id', state.club.id).eq('status', 'pending');
    state.pendingRequests = count || 0;
}

export async function loadRequests() {
    const requests = unwrap(await sb.from('club_membership_requests').select('id, user_id, created_at')
        .eq('club_id', state.club.id).eq('status', 'pending').order('created_at', { ascending: true }));
    if (!requests.length) return [];
    const { data: profiles } = await sb.from('profiles').select('id, username, display_name, avatar_url')
        .in('id', requests.map(r => r.user_id));
    const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    return requests.map(r => ({ ...r, profile: byId[r.user_id] || null }));
}

export async function approveRequest(id) {
    unwrap(await sb.rpc('approve_club_membership_request', { p_request_id: id }));
    await Promise.all([refreshRequestCount(), loadMembers()]);
}

export async function declineRequest(id) {
    unwrap(await sb.from('club_membership_requests').update({ status: 'rejected' }).eq('id', id));
    await refreshRequestCount();
}

// ─── Matches ──────────────────────────────────────────────────────────────
const fromRow = r => ({
    id: r.id, date: r.date, format: r.format || '2v2',
    teamA: r.team_a || [], teamB: r.team_b || [],
    scoreA: r.score_a, scoreB: r.score_b, ownerId: r.owner_id,
});

export async function loadMatches() {
    if (!state.club) { state.matches = []; invalidate(); return; }
    const clubId = state.club.id;
    const rows = unwrap(await sb.from('matches').select('*').eq('club_id', clubId).order('date', { ascending: false }));
    if (state.club?.id !== clubId) return; // club switched mid-flight
    state.matches = rows.map(fromRow);
    invalidate();
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

export async function addMatch({ format, teamA, teamB, scoreA, scoreB }) {
    const match = { id: newId(), date: new Date().toISOString(), format, teamA, teamB, scoreA, scoreB, ownerId: state.user.id };
    unwrap(await sb.from('matches').insert({
        id: match.id, date: match.date, format,
        team_a: teamA, team_b: teamB, score_a: scoreA, score_b: scoreB,
        club_id: state.club.id, owner_id: state.user.id,
    }));
    state.matches.unshift(match);
    invalidate();
    return match;
}

export async function updateMatch(match) {
    unwrap(await sb.from('matches').update({
        date: match.date, format: match.format,
        team_a: match.teamA, team_b: match.teamB, score_a: match.scoreA, score_b: match.scoreB,
    }).eq('id', match.id));
    state.matches = state.matches.map(m => (m.id === match.id ? { ...m, ...match } : m))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    invalidate();
}

export async function deleteMatch(id) {
    unwrap(await sb.from('matches').delete().eq('id', id));
    state.matches = state.matches.filter(m => m.id !== id);
    invalidate();
}
