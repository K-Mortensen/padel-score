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
    clubRoles = [];
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
