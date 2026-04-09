// ─── LOAD CLUB ────────────────────────────────────────────────────────────
// isOnboarding=true: called from submitUsername() on first login.
//   → show club screen if no club found (new user needs to set one up).
// isOnboarding=false (default): called for returning users on page load.
//   → always show main app; club can be configured via Settings.
async function loadUserClub(isOnboarding = false) {
    const { data } = await supabaseClient
        .from('club_members')
        .select('club_id, clubs(*)')
        .eq('user_id', currentUser.id)
        .limit(1)
        .maybeSingle();

    if (data?.clubs) {
        currentClub = data.clubs;
        await Promise.all([loadCurrentUserRole(), loadClubRoles()]);
    }

    if (!currentClub && isOnboarding) {
        showClubScreen();
    } else {
        showMainApp();
        if (currentClub) loadFromServer();
    }
}

// ─── DEFAULT ROLES ────────────────────────────────────────────────────────
const DEFAULT_ROLES = [
    { name: 'Admin',     permissions: { add_matches: true,  modify_matches: true,  delete_matches: true,  view_scores: true,  rename_club: true  } },
    { name: 'Moderator', permissions: { add_matches: true,  modify_matches: true,  delete_matches: true,  view_scores: true,  rename_club: false } },
    { name: 'Member',    permissions: { add_matches: true,  modify_matches: false, delete_matches: false, view_scores: true,  rename_club: false } },
    { name: 'Newcomer',  permissions: { add_matches: true,  modify_matches: false, delete_matches: false, view_scores: false, rename_club: false } },
];

async function createDefaultRoles(clubId) {
    const rows = DEFAULT_ROLES.map(r => ({ club_id: clubId, name: r.name, permissions: r.permissions }));
    const { data, error } = await supabaseClient.from('club_roles').insert(rows).select();
    if (!error && data) clubRoles = data;
}

// ─── CREATE CLUB ──────────────────────────────────────────────────────────
async function createClub() {
    // Guard: make sure user is loaded
    if (!currentUser) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) { alert('Not logged in. Please refresh and try again.'); return; }
        const { data: profile } = await supabaseClient
            .from('profiles').select('*').eq('id', user.id).single();
        currentUser = profile ? { ...user, ...profile } : user;
    }

    const nameInput = document.getElementById('newClubName');
    const name = nameInput.value.trim();
    if (!name) { alert('Please enter a club name.'); return; }

    const btn = document.getElementById('createClubBtn');
    btn.disabled = true; btn.textContent = 'Creating…';

    const { data: club, error } = await supabaseClient
        .from('clubs').insert({ name, owner_id: currentUser.id }).select().single();

    if (error) {
        alert('Error: ' + error.message);
        btn.disabled = false; btn.textContent = '🏟 Create Club';
        return;
    }

    await supabaseClient.from('club_members').insert({
        club_id: club.id, user_id: currentUser.id,
    });

    currentClub = club;
    currentUserRole = null; // owner bypasses role checks via hasPermission()
    await createDefaultRoles(club.id);
    showMainApp();
    loadFromServer();
}

// ─── JOIN CLUB ────────────────────────────────────────────────────────────
async function joinClub() {
    // Guard: make sure user is loaded
    if (!currentUser) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) { alert('Not logged in. Please refresh and try again.'); return; }
        const { data: profile } = await supabaseClient
            .from('profiles').select('*').eq('id', user.id).single();
        currentUser = profile ? { ...user, ...profile } : user;
    }

    const codeInput = document.getElementById('joinClubCode');
    const code = codeInput.value.trim().toUpperCase();
    if (!code) { alert('Please enter an invite code.'); return; }

    const btn = document.getElementById('joinClubBtn');
    btn.disabled = true; btn.textContent = 'Joining…';

    const { data: club, error } = await supabaseClient
        .from('clubs').select('*').eq('invite_code', code).single();

    if (error || !club) {
        alert('Club not found. Check the invite code.');
        btn.disabled = false; btn.textContent = '🔗 Join Club';
        return;
    }

    await supabaseClient.from('club_members').insert({
        club_id: club.id, user_id: currentUser.id,
    });

    currentClub = club;
    await Promise.all([loadCurrentUserRole(), loadClubRoles()]);
    showMainApp();
    loadFromServer();
}

// ─── SKIP CLUB ────────────────────────────────────────────────────────────
function skipClub() {
    showMainApp();
    setSyncStatus('', 'No club · Add one in Settings');
}

// ─── COPY INVITE CODE ─────────────────────────────────────────────────────
async function copyInviteCode() {
    if (!currentClub) return;
    try {
        await navigator.clipboard.writeText(currentClub.invite_code);
        const btn = document.getElementById('copyCodeBtn');
        if (!btn) return;
        const original = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => btn.textContent = original, 2000);
    } catch {
        alert('Invite code: ' + currentClub.invite_code);
    }
}

// ─── CLUB TAB ─────────────────────────────────────────────────────────────
async function renderClubTab() {
    const container = document.getElementById('clubMembersList');
    if (!container) return;
    if (!currentClub) {
        container.innerHTML = '<div class="no-history">Join or create a club to see members.</div>';
        return;
    }

    container.innerHTML = '<div class="no-history">Loading…</div>';

    const members = await loadClubMembers();
    const stats2v2 = computePlayerStats('2v2');
    const elo2v2   = getEloRatings('2v2');

    if (!members.length) {
        container.innerHTML = '<div class="no-history">No members found.</div>';
        return;
    }

    // Sort: owner first, then by 2v2 Elo descending
    const sorted = [...members].sort((a, b) => {
        const aOwner = a.user_id === currentClub.owner_id;
        const bOwner = b.user_id === currentClub.owner_id;
        if (aOwner !== bOwner) return aOwner ? -1 : 1;
        const aName = a.profiles?.username || a.profiles?.display_name || '';
        const bName = b.profiles?.username || b.profiles?.display_name || '';
        return (elo2v2[bName]?.rating ?? ELO_DEFAULT) - (elo2v2[aName]?.rating ?? ELO_DEFAULT);
    });

    const clubNameEl = document.getElementById('clubTabName');
    if (clubNameEl) clubNameEl.textContent = currentClub.name;

    container.innerHTML = sorted.map(m => {
        const name     = m.profiles?.username || m.profiles?.display_name || '—';
        const initials = name !== '—' ? name.slice(0, 2).toUpperCase() : '?';
        const isOwner  = m.user_id === currentClub.owner_id;
        const roleName = isOwner ? 'Owner' : (m.club_roles?.name || 'No role');

        const s      = stats2v2[name] || { w: 0, l: 0, d: 0 };
        const played = s.w + s.l + s.d;
        const wr     = played ? Math.round((s.w / played) * 100) : 0;
        const eloVal = elo2v2[name]?.rating ?? ELO_DEFAULT;
        const eloUnranked = !elo2v2[name]?.ranked;

        const avatarHTML = m.profiles?.avatar_url
            ? `<img class="cmember-avatar" src="${esc(m.profiles.avatar_url)}" alt="${esc(name)}" />`
            : `<div class="cmember-avatar cmember-initials">${esc(initials)}</div>`;

        return `<div class="cmember-card">
            ${avatarHTML}
            <div class="cmember-info">
                <div class="cmember-name">${esc(name)}</div>
                <div class="cmember-role${isOwner ? ' cmember-role-owner' : ''}">${esc(roleName)}</div>
            </div>
            <div class="cmember-stats">
                <div class="cmember-stat">
                    <span class="cmember-stat-val">${eloVal}${eloUnranked ? '<span class="cmember-unranked">*</span>' : ''}</span>
                    <span class="cmember-stat-lbl">Elo</span>
                </div>
                <div class="cmember-stat">
                    <span class="cmember-stat-val">${played}</span>
                    <span class="cmember-stat-lbl">Played</span>
                </div>
                <div class="cmember-stat">
                    <span class="cmember-stat-val">${wr}%</span>
                    <span class="cmember-stat-lbl">Win</span>
                </div>
            </div>
        </div>`;
    }).join('');
}
