// ─── SIGN IN ──────────────────────────────────────────────────────────────
async function signInWithGoogle() {
    const btn = document.getElementById('googleSignInBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://k-mortensen.github.io/padel-score/' }
    });
    if (error) {
        alert('Login failed: ' + error.message);
        if (btn) { btn.disabled = false; btn.textContent = '🔑 Sign in with Google'; }
    }
}

async function signOut() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentClub = null;
    appData = { matches: [] };
    showLoginScreen();
}

async function createOrUpdateProfile(user) {
    await supabaseClient.from('profiles').upsert({
        id: user.id,
        display_name: user.user_metadata?.full_name || user.email.split('@')[0],
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
    }, { onConflict: 'id', ignoreDuplicates: true });
}

// ─── SCREEN SWITCHING ─────────────────────────────────────────────────────
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('usernameScreen').style.display = 'none';
    document.getElementById('clubScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
}

function showUsernameScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('usernameScreen').style.display = 'flex';
    document.getElementById('clubScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
}

function showClubScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('usernameScreen').style.display = 'none';
    document.getElementById('clubScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('usernameScreen').style.display = 'none';
    document.getElementById('clubScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';

    if (currentUser) {
        const nameEl = document.getElementById('profileName');
        const avatarEl = document.getElementById('profileAvatar');
        const clubEl = document.getElementById('profileClub');
        const inviteBtn = document.getElementById('copyCodeBtn');
        if (nameEl) nameEl.textContent = currentUser.username || currentUser.display_name || currentUser.email;
        if (avatarEl && currentUser.avatar_url) {
            avatarEl.src = currentUser.avatar_url;
            avatarEl.style.display = 'block';
        }
        if (clubEl) clubEl.textContent = currentClub ? currentClub.name : 'No club · Add one in Settings';
        if (inviteBtn) inviteBtn.style.display = currentClub ? '' : 'none';
    }

    // Auto-fill player 1
    const p1 = document.getElementById('p1');
    if (p1 && !p1.value && currentUser) {
        p1.value = currentUser.username || currentUser.display_name || currentUser.email.split('@')[0];
        onPlayerInput();
    }
}

// ─── USERNAME SETUP ───────────────────────────────────────────────────────
async function submitUsername() {
    const input = document.getElementById('usernameInput');
    const username = input.value.trim();
    if (!username) { alert('Please enter a username.'); return; }
    if (username.length < 2) { alert('Username must be at least 2 characters.'); return; }

    const btn = document.getElementById('usernameSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const { error } = await supabaseClient.from('profiles')
        .update({ username })
        .eq('id', currentUser.id);

    if (error) {
        alert(error.code === '23505' ? 'That username is already taken.' : 'Error: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Get Started →';
        return;
    }

    currentUser.username = username;
    // First-time user: show club screen for onboarding
    await loadUserClub(true);
}

// ─── AUTH STATE CHANGE ────────────────────────────────────────────────────
// Guard flag: initAuth() sets this to true when it handles an existing session,
// so onAuthStateChange skips the redundant SIGNED_IN event on page load.
let authHandled = false;

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
        // Skip if initAuth() already handled this session on page load
        if (authHandled) { authHandled = false; return; }

        await createOrUpdateProfile(session.user);

        let profile = null;
        for (let i = 0; i < 3; i++) {
            const { data } = await supabaseClient
                .from('profiles').select('*').eq('id', session.user.id).single();
            if (data) { profile = data; break; }
            await new Promise(r => setTimeout(r, 500));
        }

        currentUser = profile ? { ...session.user, ...profile } : session.user;
        console.log('Auth state change, user:', currentUser);
        if (!currentUser.username) {
            showUsernameScreen();
        } else {
            await loadUserClub();
        }
    } else if (event === 'SIGNED_OUT') {
        showLoginScreen();
    }
});

// ─── CHECK SESSION ON PAGE LOAD ───────────────────────────────────────────
(async function initAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
        await createOrUpdateProfile(session.user);

        let profile = null;
        for (let i = 0; i < 3; i++) {
            const { data } = await supabaseClient
                .from('profiles').select('*').eq('id', session.user.id).single();
            if (data) { profile = data; break; }
            await new Promise(r => setTimeout(r, 500));
        }

        currentUser = profile ? { ...session.user, ...profile } : session.user;
        console.log('Session restored, user:', currentUser);
        authHandled = true; // signal to onAuthStateChange that we handled this
        if (!currentUser.username) {
            showUsernameScreen();
        } else {
            await loadUserClub();
        }
    } else {
        showLoginScreen();
    }
})();
