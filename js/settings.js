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
        clubContent.innerHTML = `
            <div class="settings-club-name">${esc(currentClub.name)}</div>
            <div class="settings-club-code">Invite code: <strong>${esc(currentClub.invite_code)}</strong></div>`;
    } else {
        clubContent.innerHTML = `
            <div class="settings-no-club">You're not in a club yet.</div>
            <input class="modal-name-input" id="settingsNewClubName" type="text" placeholder="Club name"
                   style="margin-bottom:8px;width:100%;" onkeydown="if(event.key==='Enter')createClubFromSettings()" />
            <button class="modal-btn-save" style="width:100%;margin-bottom:12px;" onclick="createClubFromSettings()">🏟 Create Club</button>
            <div class="settings-divider">— or join existing —</div>
            <input class="modal-name-input" id="settingsJoinCode" type="text" placeholder="Invite code"
                   style="text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;width:100%;"
                   onkeydown="if(event.key==='Enter')joinClubFromSettings()" />
            <button class="modal-btn-save" style="width:100%;" onclick="joinClubFromSettings()">🔗 Join Club</button>`;
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

// ─── CREATE CLUB FROM SETTINGS ────────────────────────────────────────────
async function createClubFromSettings() {
    const nameInput = document.getElementById('settingsNewClubName');
    const name = nameInput?.value.trim();
    if (!name) { alert('Please enter a club name.'); return; }

    const { data: club, error } = await supabaseClient
        .from('clubs').insert({ name, owner_id: currentUser.id }).select().single();

    if (error) { alert('Error: ' + error.message); return; }

    await supabaseClient.from('club_members').insert({
        club_id: club.id, user_id: currentUser.id,
    });

    currentClub = club;
    closeModal('settingsModal');
    showMainApp();
    loadFromServer();
}

// ─── JOIN CLUB FROM SETTINGS ──────────────────────────────────────────────
async function joinClubFromSettings() {
    const codeInput = document.getElementById('settingsJoinCode');
    const code = codeInput?.value.trim().toUpperCase();
    if (!code) { alert('Please enter an invite code.'); return; }

    const { data: club, error } = await supabaseClient
        .from('clubs').select('*').eq('invite_code', code).single();

    if (error || !club) { alert('Club not found. Check the invite code.'); return; }

    await supabaseClient.from('club_members').insert({
        club_id: club.id, user_id: currentUser.id,
    });

    currentClub = club;
    closeModal('settingsModal');
    showMainApp();
    loadFromServer();
}
