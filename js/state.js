// ─── SUPABASE ─────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://dxcztfstbznkxskcjezr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Y3p0ZnN0Ynpua3hza2NqZXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzQ2ODksImV4cCI6MjA5MDU1MDY4OX0.lD3vr-ssxI1kNXZiCoAD-TmYlvwy5zbK0itG7bdrSJ4';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── CONSTANTS ────────────────────────────────────────────────────────────
const ELO_DEFAULT = 1200;
const ELO_K = 32;
const ELO_MIN_GAMES_RANKED = 3;

// ─── SHARED STATE ─────────────────────────────────────────────────────────
let appData = { matches: [] };
let players = [];
let currentTeamA = [];
let currentTeamB = [];
let teamMode = 'random';
let matchFormat = '2v2';
let manualA = [];
let manualB = [];
let isSaving = false;
let editingMatchId = null;
let currentUser = null;
let currentClub = null;
let userClubs = [];   // all club memberships: [{ club_id, clubs: {...} }]

// ─── HTML ESCAPE HELPER ───────────────────────────────────────────────────
function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── DATE FORMAT HELPER ───────────────────────────────────────────────────
function formatDate(isoString, includeTime = false) {
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    if (includeTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    return new Date(isoString).toLocaleDateString('en-GB', opts);
}