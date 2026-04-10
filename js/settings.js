// ─── PROFILE DROPDOWN ─────────────────────────────────────────────────────
function toggleProfileMenu() {
    const m = document.getElementById('profileMenu');
    if (!m) return;
    m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

function closeProfileMenu() {
    const m = document.getElementById('profileMenu');
    if (m) m.style.display = 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('#profileMenu') && !e.target.closest('.profile-menu-btn')) {
        closeProfileMenu();
    }
});

// ─── SETTINGS MODAL ───────────────────────────────────────────────────────
function openSettingsModal() {
    const usernameInput = document.getElementById('settingsUsernameInput');
    if (usernameInput) usernameInput.value = currentUser?.username || '';

    _renderSettingsClub();

    document.getElementById('settingsModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function _renderSettingsClub() {
    const clubContent = document.getElementById('settingsClubContent');
    if (!clubContent) return;

    if (currentClub) {
        const isOwner = currentUser?.id === currentClub.owner_id;
        const canManageRoles = isOwner || hasPermission('manage_roles');

        clubContent.innerHTML = `
            <div class="settings-club-name">${esc(currentClub.name)}</div>
            <div class="settings-club-code">Invite code: <strong>${esc(currentClub.invite_code)}</strong></div>
            <button class="modal-btn-save" style="width:100%;margin-top:10px;" onclick="showInviteQR()">📱 Show QR Code</button>
            ${canManageRoles ? `
                <button class="modal-btn-save" style="width:100%;margin-top:8px;" onclick="openRolesPanel()">Manage Roles &amp; Members</button>
            ` : ''}
            ${isOwner ? `
            <div class="settings-owner-section">
                <div class="settings-label" style="margin-top:14px;">Club Management</div>
                <div class="settings-row" style="margin-bottom:8px;">
                    <input class="modal-name-input" id="settingsClubNameInput"
                           value="${esc(currentClub.name)}" placeholder="Club name"
                           onkeydown="if(event.key==='Enter')saveClubName()" />
                    <button class="modal-btn-save" onclick="saveClubName()">Rename</button>
                </div>
                <button class="modal-btn-save" style="width:100%;margin-top:8px;" onclick="openTransferOwnershipModal()">Transfer Ownership</button>
                <button class="modal-btn-cancel settings-danger-btn" style="width:100%;margin-top:8px;" onclick="deleteClub()">Delete Club</button>
            </div>` : `
            <div style="margin-top:12px;">
                <button class="modal-btn-cancel settings-danger-btn" style="width:100%;" onclick="leaveClub()">Leave Club</button>
            </div>`}`;
    } else {
        clubContent.innerHTML = `
            <div class="settings-no-club">You're not in a club yet.</div>
            <input class="modal-name-input" id="settingsNewClubName" type="text" placeholder="Club name"
                   style="margin-bottom:8px;width:100%;" onkeydown="if(event.key==='Enter')createClubFromSettings()" />
            <select class="member-role-select" id="settingsNewClubVisibility" style="width:100%;margin-bottom:8px;">
                <option value="public_invite">Invite-only — visible, needs code to join</option>
                <option value="public">Public — visible, anyone can join</option>
                <option value="private">Private — hidden, needs code to join</option>
            </select>
            <button class="modal-btn-save" style="width:100%;margin-bottom:12px;" onclick="createClubFromSettings()">🏟 Create Club</button>
            <div class="settings-divider">— or join existing —</div>
            <input class="modal-name-input" id="settingsJoinCode" type="text" placeholder="Invite code"
                   style="text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;width:100%;"
                   onkeydown="if(event.key==='Enter')joinClubFromSettings()" />
            <button class="modal-btn-save" style="width:100%;" onclick="joinClubFromSettings()">🔗 Join Club</button>`;
    }
}

// ─── DEFAULT ROLE ─────────────────────────────────────────────────────────
async function saveDefaultRole(roleId) {
    const { data, error } = await supabaseClient.from('clubs')
        .update({ default_role_id: roleId || null })
        .eq('id', currentClub.id)
        .select()
        .single();
    if (error) { alert('Error saving default role: ' + error.message); return; }
    currentClub.default_role_id = data.default_role_id;
    // Update userClubs cache so switching back to this club keeps the value
    userClubs = userClubs.map(m =>
        m.club_id === currentClub.id
            ? { ...m, clubs: { ...m.clubs, default_role_id: data.default_role_id } }
            : m
    );
    // Confirm the selection in the UI without a full re-render
    const sel = document.querySelector('.roles-panel select[onchange*="saveDefaultRole"]');
    if (sel) sel.value = currentClub.default_role_id || '';
}

// ─── INVITE QR CODE ───────────────────────────────────────────────────────
function showInviteQR() {
    if (!currentClub) return;
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(currentClub.invite_code)}`;
    const codeEl = document.getElementById('qrInviteCode');
    if (codeEl) codeEl.textContent = currentClub.invite_code;

    // Show modal first so the img element has real dimensions
    document.getElementById('qrModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const img = document.getElementById('qrImg');
    if (img && typeof QRCode !== 'undefined') {
        QRCode.toDataURL(inviteUrl, {
            width: 220, margin: 2,
            color: { dark: '#111111', light: '#ffffff' },
        }, (err, dataUrl) => {
            if (err) { console.error('QR error:', err); return; }
            img.src = dataUrl;
        });
    }
}

// ─── SAVE USERNAME ────────────────────────────────────────────────────────
async function saveUsernameSettings() {
    const input = document.getElementById('settingsUsernameInput');
    const username = input.value.trim();
    if (!username) { alert('Username cannot be empty.'); return; }
    if (username.length < 2) { alert('Username must be at least 2 characters.'); return; }

    const btn = document.getElementById('settingsUsernameSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const { error } = await supabaseClient.from('profiles')
        .update({ username })
        .eq('id', currentUser.id);

    btn.disabled = false;
    btn.textContent = 'Save';

    if (error) {
        alert(error.code === '23505' ? 'That username is already taken.' : 'Error: ' + error.message);
        return;
    }

    currentUser.username = username;
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = username;
}

// ─── RENAME CLUB ──────────────────────────────────────────────────────────
async function saveClubName() {
    const input = document.getElementById('settingsClubNameInput');
    const name = input?.value.trim();
    if (!name) { alert('Club name cannot be empty.'); return; }
    if (!hasPermission('rename_club')) { alert('You do not have permission to rename this club.'); return; }

    const { error } = await supabaseClient.from('clubs')
        .update({ name })
        .eq('id', currentClub.id);

    if (error) { alert('Error: ' + error.message); return; }

    currentClub.name = name;
    const clubEl = document.getElementById('profileClub');
    if (clubEl) clubEl.textContent = name;
    _renderSettingsClub();
}

// ─── CREATE CLUB FROM SETTINGS ────────────────────────────────────────────
async function createClubFromSettings() {
    const nameInput = document.getElementById('settingsNewClubName');
    const name = nameInput?.value.trim();
    if (!name) { alert('Please enter a club name.'); return; }

    const visibilityInput = document.getElementById('settingsNewClubVisibility');
    const visibility = visibilityInput?.value || 'public_invite';

    const { data: club, error } = await supabaseClient
        .from('clubs').insert({ name, owner_id: currentUser.id, visibility }).select().single();

    if (error) { alert('Error: ' + error.message); return; }

    await supabaseClient.from('club_members').insert({
        club_id: club.id, user_id: currentUser.id,
    });

    currentClub = club;
    currentUserRole = null;
    userClubs = [...userClubs, { club_id: club.id, clubs: club }];
    localStorage.setItem('padel-club-id', club.id);
    await createDefaultRoles(club.id);
    closeModal('settingsModal');
    showMainApp();
    loadFromServer();
}

// ─── JOIN CLUB FROM SETTINGS ──────────────────────────────────────────────
async function joinClubFromSettings() {
    const codeInput = document.getElementById('settingsJoinCode');
    const code = codeInput?.value.trim().toUpperCase();
    if (!code) { alert('Please enter an invite code.'); return; }

    // Use SECURITY DEFINER RPC so private clubs can be found by invite code
    const { data: clubs, error } = await supabaseClient
        .rpc('get_club_by_invite_code', { code });

    const club = clubs?.[0];
    if (error || !club) { alert('Club not found. Check the invite code.'); return; }

    // Already a member? Just switch.
    if (userClubs.some(m => m.club_id === club.id)) {
        closeModal('settingsModal');
        await switchClub(club.id);
        return;
    }

    await supabaseClient.from('club_members').insert({
        club_id: club.id, user_id: currentUser.id,
        role_id: club.default_role_id || null,
    });

    currentClub = club;
    userClubs = [...userClubs, { club_id: club.id, clubs: club }];
    localStorage.setItem('padel-club-id', club.id);
    await Promise.all([loadCurrentUserRole(), loadClubRoles()]);
    closeModal('settingsModal');
    showMainApp();
    loadFromServer();
}
