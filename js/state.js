// ─── CONSTANTS ────────────────────────────────────────────────────────────
const API_URL = 'https://script.google.com/macros/s/AKfycbwPreRnSFqTOhf0HGUejWjjwJNoPhVFEI7M4XExfS8XbVbMyx0oiFTInEMvqo8yg42H8Q/exec';

const ELO_DEFAULT = 1200;
const ELO_K = 32;
const ELO_MIN_GAMES_RANKED = 3;

// ─── SHARED STATE ─────────────────────────────────────────────────────────
let appData = { matches: [] };
let players = [];
let currentTeamA = [];
let currentTeamB = [];
let teamMode = 'random';
let matchFormat = '2v2'; // '2v2' or '1v1'
let manualA = [];
let manualB = [];
let isSaving = false;
let editingMatchId = null;
