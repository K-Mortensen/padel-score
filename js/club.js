// ─── LOAD ALL CLUBS FOR CURRENT USER ─────────────────────────────────────────
// isOnboarding=true: called from submitUsername() on first login.
//   → show club screen if no club found (new user needs to set one up).
// isOnboarding=false (default): called for returning users on page load.
//   → always show main app; club can be configured via Settings.
async function loadUserClubs(isOnboarding = false) {
    const { data } = await supabaseClient
        .from('club_members')
        .select('club_id, clubs(*)')
        .eq('user_id', currentUser.id);

    userClubs = data || [];

    // Restore the last-used club from localStorage, else fall back to first club
    const savedId = localStorage.getItem('padel-club-id');
    const found = userClubs.find(m => m.club_id === savedId);
    currentClub = found ? found.clubs
                 : userClubs.length ? userClubs[0].clubs
                 : null;

    if (currentClub) localStorage.setItem('padel-club-id', currentClub.id);

    if (!currentClub && isOnboarding) {
        showClubScreen();
        return;
    }

    if (currentClub) {
        await Promise.all([loadCurrentUserRole(), loadClubRoles()]);
    }
    showMainApp();
    if (currentClub) {
        loadFromServer();
        _refreshPendingRequestsBadge();
    }
}

// ─── RESET CLUB STATE ─────────────────────────────────────────────────────────
function resetClubState() {
    currentClub = null;
    currentUserRole = null;
    clubRoles = [];
    localStorage.removeItem('padel-club-id');
}

// ─── SWITCH ACTIVE CLUB ───────────────────────────────────────────────────────
async function switchClub(clubId) {
    const membership = userClubs.find(m => m.club_id === clubId);
    if (!membership) return;

    currentClub = membership.clubs;
    localStorage.setItem('padel-club-id', clubId);
    currentUserRole = null;
    clubRoles = [];

    await Promise.all([loadCurrentUserRole(), loadClubRoles()]);
    showMainApp();
    loadFromServer();
    renderClubTab();
    closeProfileMenu();
    _refreshPendingRequestsBadge();
}

// ─── LEAVE CLUB ───────────────────────────────────────────────────────────────
async function leaveClub() {
    if (!currentClub || !currentUser) return;
    if (currentClub.owner_id === currentUser.id) {
        alert('You own this club. Transfer ownership to another member or delete it first.');
        return;
    }
    if (!confirm(`Leave "${currentClub.name}"?`)) return;

    const { error } = await supabaseClient
        .from('club_members')
        .delete()
        .eq('club_id', currentClub.id)
        .eq('user_id', currentUser.id);

    if (error) { alert('Error leaving club: ' + error.message); return; }

    const leftId = currentClub.id;
    userClubs = userClubs.filter(m => m.club_id !== leftId);
    resetClubState();

    if (userClubs.length) {
        await switchClub(userClubs[0].club_id);
    } else {
        appData = { matches: [] };
        showMainApp();
    }
}

// ─── TRANSFER OWNERSHIP ───────────────────────────────────────────────────────
async function transferOwnership(newOwnerId) {
    if (!currentClub || !currentUser) return;
    const clubId = currentClub.id;

    const { error } = await supabaseClient
        .from('clubs')
        .update({ owner_id: newOwnerId })
        .eq('id', clubId);

    if (error) { alert('Error transferring ownership: ' + error.message); return; }

    // Update local state so leaveClub() won't block us as owner
    userClubs = userClubs.map(m =>
        m.club_id === clubId
            ? { ...m, clubs: { ...m.clubs, owner_id: newOwnerId } }
            : m
    );
    currentClub = { ...currentClub, owner_id: newOwnerId };

    closeModal('transferOwnershipModal');
    await leaveClub();
}

// ─── DELETE CLUB ──────────────────────────────────────────────────────────────
async function deleteClub() {
    if (!currentClub || !currentUser) return;
    if (currentClub.owner_id !== currentUser.id) {
        alert('Only the club owner can delete the club.');
        return;
    }
    if (!confirm(`Delete "${currentClub.name}"? This permanently removes all matches and members.`)) return;

    const { error } = await supabaseClient
        .from('clubs')
        .delete()
        .eq('id', currentClub.id);

    if (error) { alert('Error deleting club: ' + error.message); return; }

    const deletedId = currentClub.id;
    userClubs = userClubs.filter(m => m.club_id !== deletedId);
    resetClubState();

    if (userClubs.length) {
        await switchClub(userClubs[0].club_id);
    } else {
        appData = { matches: [] };
        showMainApp();
    }
    closeModal('clubModal');
}

// ─── DEFAULT ROLES ────────────────────────────────────────────────────────────
const DEFAULT_ROLES = [
    { name: 'Admin',     priority: 10, permissions: { add_matches: true,  modify_matches: true,  delete_matches: true,  view_scores: true,  rename_club: true,  manage_roles: true,  kick_members: true,  approve_requests: true  } },
    { name: 'Moderator', priority: 20, permissions: { add_matches: true,  modify_matches: true,  delete_matches: true,  view_scores: true,  rename_club: false, manage_roles: false, kick_members: true,  approve_requests: true  } },
    { name: 'Member',    priority: 30, permissions: { add_matches: true,  modify_matches: false, delete_matches: false, view_scores: true,  rename_club: false, manage_roles: false, kick_members: false, approve_requests: false } },
    { name: 'Newcomer',  priority: 40, permissions: { add_matches: true,  modify_matches: false, delete_matches: false, view_scores: false, rename_club: false, manage_roles: false, kick_members: false, approve_requests: false } },
];

async function createDefaultRoles(clubId) {
    const rows = DEFAULT_ROLES.map(r => ({ club_id: clubId, name: r.name, priority: r.priority, permissions: r.permissions }));
    const { data, error } = await supabaseClient.from('club_roles').insert(rows).select();
    if (!error && data) clubRoles = data;
}

// ─── CREATE CLUB (onboarding screen) ─────────────────────────────────────────
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

    const visibilityInput = document.getElementById('newClubVisibility');
    const visibility = visibilityInput?.value || 'public_invite';

    const btn = document.getElementById('createClubBtn');
    btn.disabled = true; btn.textContent = 'Creating…';

    const { data: club, error } = await supabaseClient
        .from('clubs').insert({ name, owner_id: currentUser.id, visibility }).select().single();

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
    userClubs = [...userClubs, { club_id: club.id, clubs: club }];
    localStorage.setItem('padel-club-id', club.id);
    await createDefaultRoles(club.id);
    showMainApp();
    loadFromServer();
}

// ─── SHARED JOIN-BY-CODE LOGIC ────────────────────────────────────────────────
// Resolves invite code → inserts member → updates shared state.
// Returns { club, alreadyMember: bool } on success, throws with a user-facing
// message on failure. The caller is responsible for UI feedback.
async function _resolveJoinByCode(code) {
    const { data: clubs, error } = await supabaseClient
        .rpc('get_club_by_invite_code', { code });
    const club = clubs?.[0];
    if (error || !club) throw new Error('Club not found. Check the invite code.');
    if (userClubs.some(m => m.club_id === club.id)) return { club, alreadyMember: true };

    await supabaseClient.from('club_members').insert({
        club_id: club.id, user_id: currentUser.id,
        role_id: club.default_role_id || null,
    });
    currentClub = club;
    userClubs = [...userClubs, { club_id: club.id, clubs: club }];
    localStorage.setItem('padel-club-id', club.id);
    await Promise.all([loadCurrentUserRole(), loadClubRoles()]);
    return { club, alreadyMember: false };
}

// ─── JOIN CLUB (onboarding screen) ───────────────────────────────────────────
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

    try {
        const { club, alreadyMember } = await _resolveJoinByCode(code);
        if (alreadyMember) {
            await switchClub(club.id);
            btn.disabled = false; btn.textContent = '🔗 Join Club';
            return;
        }
        showMainApp();
        loadFromServer();
    } catch (e) {
        alert(e.message);
        btn.disabled = false; btn.textContent = '🔗 Join Club';
    }
}

// ─── SKIP CLUB ────────────────────────────────────────────────────────────────
function skipClub() {
    showMainApp();
    setSyncStatus('', 'No club · Add one in Settings');
}

// ─── COPY INVITE CODE ─────────────────────────────────────────────────────────
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

// ─── LOAD VISIBLE CLUBS (for Browse Clubs modal) ──────────────────────────────
async function loadVisibleClubs() {
    // RLS returns: public + public_invite clubs + user's own (private) clubs
    const { data: clubs } = await supabaseClient
        .from('clubs')
        .select('id, name, visibility, owner_id, invite_code, default_role_id')
        .order('name');

    if (!clubs?.length) return [];

    // Fetch member counts in a second query
    const { data: memberRows } = await supabaseClient
        .from('club_members')
        .select('club_id')
        .in('club_id', clubs.map(c => c.id));

    const countMap = {};
    (memberRows || []).forEach(r => {
        countMap[r.club_id] = (countMap[r.club_id] || 0) + 1;
    });

    return clubs.map(c => ({ ...c, memberCount: countMap[c.id] || 0 }));
}

// ─── CLUB MODAL (Switch / Browse / Manage) ────────────────────────────────────
async function openClubModal(tab = 'switch') {
    const modal = document.getElementById('clubModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    await switchClubModalTab(tab);
}

async function switchClubModalTab(tab) {
    ['switch', 'browse', 'manage'].forEach(t => {
        const pane = document.getElementById(`cmPane-${t}`);
        const btn  = document.getElementById(`cmTab-${t}`);
        if (pane) pane.style.display = t === tab ? '' : 'none';
        if (btn)  btn.classList.toggle('active', t === tab);
    });
    if (tab === 'switch')  _renderClubModalSwitch();
    if (tab === 'browse')  await _initClubModalBrowse();
    if (tab === 'manage') {
        const manageTitle = document.getElementById('clubManageTitle');
        if (manageTitle) manageTitle.textContent = currentClub?.name || '';
        const dangerEl = document.getElementById('clubManageDanger');
        if (dangerEl) dangerEl.style.display = currentUser?.id === currentClub?.owner_id ? '' : 'none';
        await _refreshPendingRequestsBadge();
        await switchManageTab('roles');
    }
}

// ── Switch tab ───────────────────────────────────────────────────────────────
function _renderClubModalSwitch() {
    const listEl = document.getElementById('clubModalSwitchList');
    if (!listEl) return;
    if (!userClubs.length) {
        listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">You are not in any clubs.</div>';
        return;
    }
    listEl.innerHTML = userClubs.map(m => {
        const club = m.clubs;
        const isCurrent = club.id === currentClub?.id;
        return `<div class="switch-club-item${isCurrent ? ' switch-club-active' : ''}">
            <span class="switch-club-name">${esc(club.name)}</span>
            ${isCurrent
                ? '<span class="switch-club-current">Current</span>'
                : `<button class="modal-btn-save switch-club-btn" onclick="switchClub('${esc(club.id)}');closeModal('clubModal')">Switch</button>`
            }
        </div>`;
    }).join('');
}

// ── Browse tab ───────────────────────────────────────────────────────────────
let _browseClubsData = [];
let _browseMyRequests = new Set(); // club_ids where user has a pending request

async function _initClubModalBrowse() {
    const searchInput = document.getElementById('clubModalBrowseSearch');
    const listEl = document.getElementById('clubModalBrowseList');
    if (searchInput) searchInput.value = '';
    if (listEl) listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px 0;">Loading…</div>';

    const [clubs, requestsResult] = await Promise.all([
        loadVisibleClubs(),
        supabaseClient
            .from('club_membership_requests')
            .select('club_id')
            .eq('user_id', currentUser.id)
            .eq('status', 'pending'),
    ]);
    _browseClubsData = clubs;
    _browseMyRequests = new Set(requestsResult.data?.map(r => r.club_id) || []);
    _renderBrowseClubs('');

    if (searchInput) {
        searchInput.oninput = () => _renderBrowseClubs(searchInput.value.trim().toLowerCase());
    }
}

function _renderBrowseClubs(query) {
    const listEl = document.getElementById('clubModalBrowseList');
    if (!listEl) return;

    const filtered = query
        ? _browseClubsData.filter(c => c.name.toLowerCase().includes(query))
        : _browseClubsData;

    if (!filtered.length) {
        listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px 0;">No clubs found.</div>';
        return;
    }

    const memberIds = new Set(userClubs.map(m => m.club_id));

    listEl.innerHTML = filtered.map(c => {
        const isCurrent = c.id === currentClub?.id;
        const isMember = memberIds.has(c.id);
        const isOwner = c.owner_id === currentUser?.id;
        const visLabel = c.visibility === 'public' ? 'Public'
                       : c.visibility === 'public_invite' ? 'Invite-only'
                       : 'Private';
        const visClass = c.visibility === 'public' ? 'browse-vis-public'
                       : c.visibility === 'public_invite' ? 'browse-vis-invite'
                       : 'browse-vis-private';

        let actionBtn = '';
        if (isCurrent) {
            actionBtn = `<span class="switch-club-current">Current</span>`;
        } else if (isMember || isOwner) {
            actionBtn = `<button class="modal-btn-save browse-club-action" onclick="switchClub('${esc(c.id)}');closeModal('clubModal')">Switch →</button>`;
        } else if (c.visibility === 'public') {
            actionBtn = `<button class="modal-btn-save browse-club-action" onclick="_joinClubById('${esc(c.id)}')">Join</button>`;
        } else if (c.visibility === 'public_invite') {
            if (_browseMyRequests.has(c.id)) {
                actionBtn = `<span class="browse-request-pending">Pending…</span>`;
            } else {
                actionBtn = `<button class="modal-btn-save browse-club-action" onclick="_requestMembership('${esc(c.id)}')">Request membership</button>`;
            }
        } else {
            actionBtn = `<button class="modal-btn-save browse-club-action" onclick="_joinClubByCode('${esc(c.id)}','${esc(c.invite_code)}')">Join with code</button>`;
        }

        return `<div class="browse-club-card">
            <div class="browse-club-info">
                <div class="browse-club-name">${esc(c.name)}</div>
                <div class="browse-club-meta">
                    <span class="browse-vis-badge ${visClass}">${visLabel}</span>
                    <span class="browse-club-count">${c.memberCount} member${c.memberCount !== 1 ? 's' : ''}</span>
                </div>
            </div>
            ${actionBtn}
        </div>`;
    }).join('');
}

// Join a public club directly (no invite code needed)
async function _joinClubById(clubId) {
    const club = _browseClubsData.find(c => c.id === clubId);
    if (!club) return;

    const { error } = await supabaseClient.from('club_members').insert({
        club_id: club.id, user_id: currentUser.id,
        role_id: club.default_role_id || null,
    });
    if (error) { alert('Error joining club: ' + error.message); return; }

    userClubs = [...userClubs, { club_id: club.id, clubs: club }];
    closeModal('clubModal');
    await switchClub(club.id);
}

// Join an invite-only/private club — prompt for code and verify
async function _joinClubByCode(clubId, expectedCode) {
    const code = prompt('Enter the invite code for this club:');
    if (!code) return;
    if (code.trim().toUpperCase() !== expectedCode.toUpperCase()) {
        alert('Incorrect invite code.');
        return;
    }
    await _joinClubById(clubId);
}

// Send a membership request for a public_invite club
async function _requestMembership(clubId) {
    const { error } = await supabaseClient
        .from('club_membership_requests')
        .insert({ club_id: clubId, user_id: currentUser.id });
    if (error) { alert('Error sending request: ' + error.message); return; }
    _browseMyRequests.add(clubId);
    _renderBrowseClubs(document.getElementById('clubModalBrowseSearch')?.value?.trim()?.toLowerCase() || '');
}

// ── Manage tab ───────────────────────────────────────────────────────────────
async function switchManageTab(tab) {
    ['roles', 'members', 'requests'].forEach(t => {
        const btn = document.getElementById(`cmManageTab-${t}`);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    const content = document.getElementById('clubManageContent');
    if (!content) return;
    content.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:12px 0;">Loading…</div>';

    // Point panel renders at the Club modal container, no back button
    _panelTarget = 'clubManageContent';
    _rolesBackFn = null;

    if (tab === 'roles') {
        await loadClubRoles();
        _renderRolesPanel();
    } else if (tab === 'requests') {
        await _renderRequestsPanel();
    } else {
        await Promise.all([loadClubRoles(), _loadRolesPanelMembers()]);
        _renderMembersPanel();
    }
}

// Refresh all pending-requests badges (profile menu, Club tab, Manage tab, inner tab).
// Called on app load, after approve/decline, and when the manage pane opens.
async function _refreshPendingRequestsBadge() {
    const canApprove = currentClub && (
        currentClub.owner_id === currentUser?.id ||
        hasPermission('approve_requests')
    );

    // Inner "Requests" manage sub-tab visibility
    const innerTabBtn = document.getElementById('cmManageTab-requests');
    if (innerTabBtn) innerTabBtn.style.display = canApprove ? '' : 'none';

    if (!canApprove) {
        // Hide all badges when user has no permission
        ['cmRequestsBadge', 'menuRequestsBadge', 'profileBtnBadge', 'manageTabRequestsBadge']
            .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        return;
    }

    const { count } = await supabaseClient
        .from('club_membership_requests')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', currentClub.id)
        .eq('status', 'pending');

    const pendingCount = count || 0;

    ['cmRequestsBadge', 'menuRequestsBadge', 'profileBtnBadge', 'manageTabRequestsBadge']
        .forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (pendingCount > 0) {
                el.textContent = pendingCount;
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
}

// Render the pending membership requests panel
async function _renderRequestsPanel() {
    const content = document.getElementById(_panelTarget);
    if (!content) return;

    const { data: requests, error } = await supabaseClient
        .from('club_membership_requests')
        .select('id, user_id, created_at')
        .eq('club_id', currentClub.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (error) {
        content.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Error loading requests.</div>`;
        return;
    }

    if (!requests?.length) {
        content.innerHTML = `<div class="roles-panel"><div style="color:var(--text-faint);font-size:0.85rem;padding:8px 0;">No pending membership requests.</div></div>`;
        return;
    }

    // Fetch profiles separately (profiles table has restrictive RLS)
    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, username, display_name')
        .in('id', requests.map(r => r.user_id));
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    const itemsHTML = requests.map(r => {
        const profile = profileMap[r.user_id];
        const rawName = profile?.username || profile?.display_name || r.user_id;
        const name = esc(rawName);
        const date = new Date(r.created_at).toLocaleDateString();
        return `<div class="member-item request-item">
            <div>
                <span class="member-name">${name}</span>
                <span style="font-size:0.75rem;color:var(--text-faint);margin-left:6px;">${date}</span>
            </div>
            <div class="request-actions">
                <button class="role-action-btn" onclick="_approveRequest('${esc(r.id)}')">Approve</button>
                <button class="role-action-btn role-action-delete" onclick="_declineRequest('${esc(r.id)}')">Decline</button>
            </div>
        </div>`;
    }).join('');

    content.innerHTML = `<div class="roles-panel">
        <div class="settings-label" style="margin-top:12px;">Membership Requests</div>
        <div class="members-list">${itemsHTML}</div>
    </div>`;
}

// Approve a membership request — uses SECURITY DEFINER RPC so the approver
// can add the requester to club_members (INSERT policy only allows self-joins).
async function _approveRequest(requestId) {
    const { error } = await supabaseClient.rpc('approve_club_membership_request', { p_request_id: requestId });
    if (error) { alert('Error approving request: ' + error.message); return; }
    await _refreshPendingRequestsBadge();
    await _renderRequestsPanel();
}

// Decline a membership request
async function _declineRequest(requestId) {
    const { error } = await supabaseClient
        .from('club_membership_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);
    if (error) { alert('Error declining request: ' + error.message); return; }
    await _refreshPendingRequestsBadge();
    await _renderRequestsPanel();
}

function toggleClubAddSection() {
    const el = document.getElementById('clubAddSection');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// Backward-compat: dropdown used to call these directly
function openSwitchClubModal() { openClubModal('switch'); }
function openBrowseClubs()     { openClubModal('browse'); }

// ─── OPEN TRANSFER OWNERSHIP MODAL ───────────────────────────────────────────
async function openTransferOwnershipModal() {
    const modal = document.getElementById('transferOwnershipModal');
    if (!modal) return;

    const listEl = document.getElementById('transferOwnershipList');
    if (listEl) listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">Loading members…</div>';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const members = await loadClubMembers();
    const candidates = members.filter(m => m.user_id !== currentUser.id);

    if (!listEl) return;

    if (!candidates.length) {
        listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">No other members to transfer to.</div>';
        return;
    }

    listEl.innerHTML = candidates.map(m => {
        const name = m.profiles?.username || m.profiles?.display_name || m.user_id;
        return `<div class="transfer-member-item">
            <span class="transfer-member-name">${esc(name)}</span>
            <button class="modal-btn-save transfer-member-btn" onclick="confirmTransferTo('${esc(m.user_id)}','${esc(name)}')">Transfer to ${esc(name)}</button>
        </div>`;
    }).join('');
}

async function confirmTransferTo(newOwnerId, name) {
    if (!confirm(`Transfer ownership of "${currentClub.name}" to ${name}? You will remain a member.`)) return;
    await transferOwnership(newOwnerId);
}

// ─── CLUB TAB ─────────────────────────────────────────────────────────────────
async function renderClubTab() {
    const container = document.getElementById('clubMembersList');
    if (!container) return;
    if (!currentClub) {
        container.innerHTML = '<div class="no-history">Join or create a club to see members.</div>';
        return;
    }
    container.innerHTML = '<div class="no-history">Loading…</div>';
    const members = await loadClubMembers();
    if (!members.length) {
        container.innerHTML = '<div class="no-history">No members found.</div>';
        return;
    }
    _renderClubMembers(members);
}

function _renderClubMembers(members) {
    const stats2v2 = computePlayerStats('2v2');
    const elo2v2   = getEloRatings('2v2');

    // Sort: owner first, then by 2v2 Elo descending
    const sorted = [...members].sort((a, b) => {
        const isOwnerA = a.user_id === currentClub.owner_id;
        const isOwnerB = b.user_id === currentClub.owner_id;
        if (isOwnerA !== isOwnerB) return isOwnerA ? -1 : 1;
        const nameA = a.profiles?.username || a.profiles?.display_name || '';
        const nameB = b.profiles?.username || b.profiles?.display_name || '';
        return (elo2v2[nameB]?.rating ?? ELO_DEFAULT) - (elo2v2[nameA]?.rating ?? ELO_DEFAULT);
    });

    const container = document.getElementById('clubMembersList');
    const clubNameEl = document.getElementById('clubTabName');
    if (clubNameEl) clubNameEl.textContent = currentClub.name;

    container.innerHTML = sorted.map(m => {
        const name     = m.profiles?.username || m.profiles?.display_name || '—';
        const initials = name !== '—' ? name.slice(0, 2).toUpperCase() : '?';
        const isOwner  = m.user_id === currentClub.owner_id;
        const roleName = isOwner ? 'Owner' : (m.club_roles?.name || 'No role');

        const playerStats = stats2v2[name] || { w: 0, l: 0, d: 0 };
        const played = playerStats.w + playerStats.l + playerStats.d;
        const wr     = played ? Math.round((playerStats.w / played) * 100) : 0;
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
