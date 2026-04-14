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

// Auto-save and close the settings modal.
// Called by the Close button and overlay click — NOT by programmatic closes
// after create/join/delete actions (those use closeModal directly).
async function closeSettingsModal() {
    await _settingsAutoSave();
    closeModal('settingsModal');
}

async function _settingsAutoSave() {
    // 1. Username — save if changed
    const usernameInput = document.getElementById('settingsUsernameInput');
    const newUsername = usernameInput?.value.trim();
    if (newUsername && newUsername !== (currentUser?.username || '')) {
        if (newUsername.length < 2) { alert('Username must be at least 2 characters.'); return; }

        const oldUsername = currentUser.username;

        // Atomically update the profile username AND rename the player in all
        // historical matches so ELO history stays continuous.
        const { error } = await supabaseClient.rpc('update_username_and_matches', {
            new_username: newUsername,
        });
        if (error) {
            alert(error.code === '23505' ? 'That username is already taken.' : 'Error: ' + error.message);
            return;
        }

        // Patch in-memory matches so ELO recomputes without a full reload
        appData.matches.forEach(m => {
            m.teamA = m.teamA.map(n => n === oldUsername ? newUsername : n);
            m.teamB = m.teamB.map(n => n === oldUsername ? newUsername : n);
        });
        invalidateEloCache();

        currentUser.username = newUsername;
        const nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.textContent = newUsername;

        // Update player 1 input if it was auto-filled with the old username
        const p1 = document.getElementById('p1');
        if (p1 && p1.value === oldUsername) {
            p1.value = newUsername;
            onPlayerInput();
        }
    }

}

function _renderSettingsClub() {
    const clubContent = document.getElementById('settingsClubContent');
    if (!clubContent) return;

    if (currentClub) {
        const isOwner = currentUser?.id === currentClub.owner_id;

        clubContent.innerHTML = `
            <div class="settings-club-name">${esc(currentClub.name)}</div>
            <div class="settings-club-code">Invite code: <strong>${esc(currentClub.invite_code)}</strong></div>
            ${!isOwner ? `
            <div style="margin-top:12px;">
                <button class="modal-btn-cancel settings-danger-btn" style="width:100%;" onclick="leaveClub()">Leave Club</button>
            </div>` : ''}`;
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
    closeModal('clubModal');
    showMainApp();
    loadFromServer();
}

// ─── JOIN CLUB FROM SETTINGS ──────────────────────────────────────────────
async function joinClubFromSettings() {
    const codeInput = document.getElementById('settingsJoinCode');
    const code = codeInput?.value.trim().toUpperCase();
    if (!code) { alert('Please enter an invite code.'); return; }

    try {
        const { club, alreadyMember } = await _resolveJoinByCode(code);
        if (alreadyMember) {
            closeModal('clubModal');
            await switchClub(club.id);
            return;
        }
        closeModal('clubModal');
        showMainApp();
        loadFromServer();
    } catch (e) {
        alert(e.message);
    }
}
