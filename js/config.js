import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// Public anon key — safe to ship; access is enforced by Row Level Security.
const SUPABASE_URL = 'https://dxcztfstbznkxskcjezr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Y3p0ZnN0Ynpua3hza2NqZXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzQ2ODksImV4cCI6MjA5MDU1MDY4OX0.lD3vr-ssxI1kNXZiCoAD-TmYlvwy5zbK0itG7bdrSJ4';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const ELO_DEFAULT = 1200;
export const ELO_K = 32;
export const ELO_MIN_GAMES_RANKED = 3;
export const MAX_SCORE = 99;

export const PERM_LABELS = {
    add_matches:      'Add matches',
    modify_matches:   'Edit matches',
    delete_matches:   'Delete matches',
    view_scores:      'View scores & rankings',
    rename_club:      'Rename club',
    manage_roles:     'Manage roles',
    kick_members:     'Remove members',
    approve_requests: 'Approve join requests',
};
export const ALL_PERMS = Object.keys(PERM_LABELS);

export const DEFAULT_ROLES = [
    { name: 'Admin',     priority: 10, permissions: { add_matches: true, modify_matches: true,  delete_matches: true,  view_scores: true,  rename_club: true,  manage_roles: true,  kick_members: true,  approve_requests: true  } },
    { name: 'Moderator', priority: 20, permissions: { add_matches: true, modify_matches: true,  delete_matches: true,  view_scores: true,  rename_club: false, manage_roles: false, kick_members: true,  approve_requests: true  } },
    { name: 'Member',    priority: 30, permissions: { add_matches: true, modify_matches: false, delete_matches: false, view_scores: true,  rename_club: false, manage_roles: false, kick_members: false, approve_requests: false } },
    { name: 'Newcomer',  priority: 40, permissions: { add_matches: true, modify_matches: false, delete_matches: false, view_scores: false, rename_club: false, manage_roles: false, kick_members: false, approve_requests: false } },
];

export const VISIBILITY = {
    public:        { label: 'Public',      hint: 'Anyone can find and join' },
    public_invite: { label: 'Invite-only', hint: 'Visible — people request to join' },
    private:       { label: 'Private',     hint: 'Hidden — join with invite code' },
};
