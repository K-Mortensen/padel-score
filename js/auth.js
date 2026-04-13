// ─── PENDING INVITE (from QR scan or shared link) ─────────────────────────
// Capture ?invite=CODE from URL, persist in sessionStorage so it survives the
// Google OAuth redirect (which navigates away and back without the param).
{
    const _inv = new URLSearchParams(window.location.search).get('invite');
    if (_inv) {
        try { sessionStorage.setItem('padel-invite', _inv.toUpperCase()); } catch {}
        const _u = new URL(window.location.href);
        _u.searchParams.delete('invite');
        window.history.replaceState({}, '', _u);
    }
}
function _popPendingInvite() {
    try {
        const code = sessionStorage.getItem('padel-invite') || '';
        if (code) sessionStorage.removeItem('padel-invite');
        return code;
    } catch { return ''; }
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────
const PROFILE_LOAD_MAX_RETRIES = 3;
const PROFILE_LOAD_RETRY_DELAY_MS = 500;

// ─── SIGN IN ──────────────────────────────────────────────────────────────
async function signInWithGoogle() {
    const btn = document.getElementById('googleSignInBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
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
    userClubs = [];
    currentUserRole = null;
    clubRoles = [];
    appData = { matches: [] };
    localStorage.removeItem('padel-club-id');
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
function setLoadingText(text) {
    const el = document.getElementById('loadingStatus');
    if (el) el.textContent = text;
}

function hideLoadingScreen() {
    const el = document.getElementById('loadingScreen');
    if (!el || el.style.display === 'none') return;
    el.classList.add('fade-out');
    setTimeout(() => { el.style.display = 'none'; el.classList.remove('fade-out'); }, 200);
}

const _APP_SCREENS = ['loginScreen', 'usernameScreen', 'clubScreen', 'mainApp'];
function switchScreen(activeId) {
    _APP_SCREENS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === activeId ? 'flex' : 'none';
    });
}

function showLoginScreen() {
    hideLoadingScreen();
    switchScreen('loginScreen');
}

function showUsernameScreen() {
    hideLoadingScreen();
    switchScreen('usernameScreen');
}

function showClubScreen() {
    hideLoadingScreen();
    switchScreen('clubScreen');
    // Auto-fill invite code if user arrived via QR scan or shared link
    const invite = _popPendingInvite();
    if (invite) {
        const input = document.getElementById('joinClubCode');
        if (input) input.value = invite;
    }
}

function showMainApp() {
    hideLoadingScreen();
    switchScreen('mainApp');

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
        const clubTabBtn = document.getElementById('clubTabBtn');
        if (clubTabBtn) clubTabBtn.style.display = currentClub ? '' : 'none';
        const titleEl = document.getElementById('appTitle');
        if (titleEl) titleEl.textContent = currentClub ? currentClub.name : 'PADEL FIREMATCH';
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
    await loadUserClubs(true);
}

// ─── AUTH STATE CHANGE ────────────────────────────────────────────────────
// Only handle sign-out here. All sign-in flows use redirect OAuth so the page
// always reloads — initAuth() below handles every session case on page load.
supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') showLoginScreen();
});

// ─── CHECK SESSION ON PAGE LOAD ───────────────────────────────────────────
(async function initAuth() {
    setLoadingText('Checking session…');
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
        setLoadingText('Verifying account…');
        await createOrUpdateProfile(session.user);

        setLoadingText('Loading profile…');
        let profile = null;
        for (let i = 0; i < PROFILE_LOAD_MAX_RETRIES; i++) {
            const { data } = await supabaseClient
                .from('profiles').select('*').eq('id', session.user.id).single();
            if (data) { profile = data; break; }
            await new Promise(r => setTimeout(r, PROFILE_LOAD_RETRY_DELAY_MS));
        }

        currentUser = profile ? { ...session.user, ...profile } : session.user;
        if (!currentUser.username) {
            showUsernameScreen();
        } else {
            setLoadingText('Loading club…');
            await loadUserClubs();
        }
    } else {
        showLoginScreen();
    }
})();
