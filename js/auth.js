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
        display_name: user.user_metadata.full_name || user.email.split('@')[0],
        email: user.email,
        avatar_url: user.user_metadata.avatar_url || null,
    }, { onConflict: 'id', ignoreDuplicates: true });
}

// ─── SCREEN SWITCHING ─────────────────────────────────────────────────────
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('clubScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
}

function showClubScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('clubScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('clubScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';

    if (currentUser) {
        const nameEl = document.getElementById('profileName');
        const avatarEl = document.getElementById('profileAvatar');
        const clubEl = document.getElementById('profileClub');
        if (nameEl) nameEl.textContent = currentUser.display_name;
        if (avatarEl && currentUser.avatar_url) {
            avatarEl.src = currentUser.avatar_url;
            avatarEl.style.display = 'block';
        }
        if (clubEl && currentClub) clubEl.textContent = currentClub.name;
    }

    // Auto-fill player 1
    const p1 = document.getElementById('p1');
    if (p1 && !p1.value && currentUser) {
        p1.value = currentUser.display_name;
        onPlayerInput();
    }
}

// ─── AUTH LISTENER ────────────────────────────────────────────────────────
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
        await createOrUpdateProfile(session.user);
        const { data: profile } = await supabaseClient
            .from('profiles').select('*').eq('id', session.user.id).single();
        currentUser = profile ? { ...session.user, ...profile } : session.user;
        await loadUserClub();
    } else {
        showLoginScreen();
    }
});