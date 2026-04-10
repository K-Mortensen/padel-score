// ─── ROLES & PERMISSIONS ──────────────────────────────────────────────────
// Permissions: delete_matches, modify_matches, add_matches, view_scores,
//              rename_club, manage_roles
// Club owner always has all permissions regardless of role.
// Members with no role assigned can add_matches only (default).

let clubRoles = [];          // all roles for currentClub
let currentUserRole = null;  // current user's role object (or null if no role)

function hasPermission(perm) {
    if (!currentClub || !currentUser) return false;
    if (currentClub.owner_id === currentUser.id) return true; // owner has all perms
    if (currentUserRole) return currentUserRole.permissions?.[perm] === true;
    // No role assigned: default = add_matches only
    return perm === 'add_matches';
}

// ─── LOAD ─────────────────────────────────────────────────────────────────
async function loadClubRoles() {
    if (!currentClub) return;
    const { data, error } = await supabaseClient
        .from('club_roles')
        .select('*')
        .eq('club_id', currentClub.id)
        .order('created_at', { ascending: true });
    if (!error) clubRoles = data || [];
}

async function loadCurrentUserRole() {
    if (!currentClub || !currentUser) return;
    currentUserRole = null;
    const { data } = await supabaseClient
        .from('club_members')
        .select('role_id, club_roles(*)')
        .eq('club_id', currentClub.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
    if (data?.club_roles) currentUserRole = data.club_roles;
}

async function loadClubMembers() {
    if (!currentClub) return [];

    // Step 1: members + their role info
    const { data: members, error } = await supabaseClient
        .from('club_members')
        .select('user_id, role_id, club_roles(id, name)')
        .eq('club_id', currentClub.id);
    if (error) { console.error('loadClubMembers error:', error); return []; }
    if (!members?.length) return [];

    // Step 2: profiles fetched separately (works even if profiles has restrictive RLS)
    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', members.map(m => m.user_id));

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    return members.map(m => ({ ...m, profiles: profileMap[m.user_id] || null }));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────
async function createRole(name, permissions) {
    const { data, error } = await supabaseClient
        .from('club_roles')
        .insert({ club_id: currentClub.id, name, permissions })
        .select()
        .single();
    if (error) throw error;
    clubRoles.push(data);
    return data;
}

async function updateRole(roleId, name, permissions) {
    const { error } = await supabaseClient
        .from('club_roles')
        .update({ name, permissions })
        .eq('id', roleId)
        .eq('club_id', currentClub.id);
    if (error) throw error;
    const idx = clubRoles.findIndex(r => r.id === roleId);
    if (idx !== -1) clubRoles[idx] = { ...clubRoles[idx], name, permissions };
}

async function deleteRole(roleId) {
    const { error } = await supabaseClient
        .from('club_roles')
        .delete()
        .eq('id', roleId)
        .eq('club_id', currentClub.id);
    if (error) throw error;
    clubRoles = clubRoles.filter(r => r.id !== roleId);
}

async function assignMemberRole(userId, roleId) {
    const { error } = await supabaseClient
        .from('club_members')
        .update({ role_id: roleId || null })
        .eq('club_id', currentClub.id)
        .eq('user_id', userId);
    if (error) throw error;
}

// ─── ROLES PANEL (rendered inside settings modal or club modal) ───────────
const PERM_LABELS = {
    add_matches:    'Add matches',
    modify_matches: 'Modify matches',
    delete_matches: 'Delete matches',
    view_scores:    'View scores',
    rename_club:    'Rename club',
    manage_roles:   'Manage roles & members',
    kick_members:   'Kick members',
};
const ALL_PERMS = Object.keys(PERM_LABELS);

// Context vars — set by callers before rendering so panels know where to
// render and what to do on "← Back". Defaults to the Settings modal context.
let _panelTarget  = 'settingsClubContent';
let _rolesBackFn  = () => _renderSettingsClub();

// ── Roles-only panel ────────────────────────────────────────────────────────
async function openRolesPanel() {
    _panelTarget = 'settingsClubContent';
    _rolesBackFn = () => _renderSettingsClub();
    const content = document.getElementById(_panelTarget);
    if (!content) return;
    content.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:12px 0;">Loading…</div>';
    await loadClubRoles();
    _renderRolesPanel();
}

function _renderRolesPanel() {
    const content = document.getElementById(_panelTarget);
    if (!content) return;

    const rolesHTML = clubRoles.length
        ? clubRoles.map(r => {
            const permBadges = ALL_PERMS
                .filter(p => r.permissions?.[p])
                .map(p => `<span class="perm-badge">${PERM_LABELS[p]}</span>`)
                .join('');
            return `<div class="role-item">
                <div class="role-item-name">${esc(r.name)}</div>
                <div class="role-perms">${permBadges || '<span style="color:var(--text-faint);font-size:0.75rem;">No permissions</span>'}</div>
                <div class="role-item-actions">
                    <button class="role-action-btn" onclick="openEditRoleForm('${esc(r.id)}')">Edit</button>
                    <button class="role-action-btn role-action-delete" onclick="confirmDeleteRole('${esc(r.id)}','${esc(r.name)}')">Delete</button>
                </div>
            </div>`;
        }).join('')
        : '<div style="color:var(--text-faint);font-size:0.8rem;padding:8px 0;">No roles yet.</div>';

    content.innerHTML = `
        <div class="roles-panel">
            ${_rolesBackFn ? `<button class="role-back-btn" onclick="_rolesBackFn()">← Back</button>` : ''}

            <div class="settings-label" style="margin-top:12px;">Roles</div>
            <div class="roles-list">${rolesHTML}</div>
            <button class="modal-btn-save" style="width:100%;margin-top:8px;" onclick="openAddRoleForm()">+ Add Role</button>

            <div id="roleFormContainer"></div>
        </div>`;
}

// ── Members-only panel ───────────────────────────────────────────────────────
let _rolesPanelMembers = [];
async function _loadRolesPanelMembers() {
    _rolesPanelMembers = await loadClubMembers();
}

async function openMembersPanel() {
    _panelTarget = 'settingsClubContent';
    _rolesBackFn = () => _renderSettingsClub();
    const content = document.getElementById(_panelTarget);
    if (!content) return;
    content.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:12px 0;">Loading…</div>';
    await Promise.all([loadClubRoles(), _loadRolesPanelMembers()]);
    _renderMembersPanel();
}

function _renderMembersPanel() {
    const content = document.getElementById(_panelTarget);
    if (!content) return;

    const canKick = currentUser?.id === currentClub?.owner_id || hasPermission('kick_members');
    const membersHTML = _rolesPanelMembers.length
        ? _rolesPanelMembers.map(m => {
            const rawName = m.profiles?.username || m.profiles?.display_name || m.user_id;
            const name = esc(rawName);
            const roleOptions = `<option value="">— No role —</option>` +
                clubRoles.map(r => `<option value="${esc(r.id)}" ${m.role_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
            const isOwner = m.user_id === currentClub?.owner_id;
            const isSelf  = m.user_id === currentUser?.id;
            const showKick = canKick && !isOwner && !isSelf;
            return `<div class="member-item">
                <span class="member-name">${name}${isOwner ? ' <span class="owner-badge">Owner</span>' : ''}</span>
                ${isOwner
                    ? '<span style="font-size:0.75rem;color:var(--text-faint);">All permissions</span>'
                    : `<select class="member-role-select" onchange="applyMemberRole('${esc(m.user_id)}',this.value)">${roleOptions}</select>`
                }
                ${showKick ? `<button class="role-action-btn role-action-delete" onclick="kickMember('${esc(m.user_id)}','${esc(rawName)}')">Kick</button>` : ''}
            </div>`;
        }).join('')
        : '<div style="color:var(--text-faint);font-size:0.8rem;padding:8px 0;">No members found.</div>';

    const isOwner = currentUser?.id === currentClub?.owner_id;
    const defaultRoleOptionsHTML = `<option value="">— No default role —</option>` +
        clubRoles.map(r => `<option value="${esc(r.id)}" ${currentClub?.default_role_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');

    content.innerHTML = `
        <div class="roles-panel">
            ${_rolesBackFn ? `<button class="role-back-btn" onclick="_rolesBackFn()">← Back</button>` : ''}

            <div class="settings-label" style="margin-top:12px;">Members</div>
            <div class="members-list">${membersHTML}</div>

            ${isOwner ? `
            <div class="settings-label" style="margin-top:16px;">Default role for new members</div>
            <select class="member-role-select" style="width:100%;margin-top:4px;" onchange="saveDefaultRole(this.value)">
                ${defaultRoleOptionsHTML}
            </select>` : ''}
        </div>`;
}

function openAddRoleForm() {
    _renderRoleForm(null);
}

function openEditRoleForm(roleId) {
    const role = clubRoles.find(r => r.id === roleId);
    if (role) _renderRoleForm(role);
}

function _renderRoleForm(role) {
    const container = document.getElementById('roleFormContainer');
    if (!container) return;
    const permsHTML = ALL_PERMS.map(p => `
        <label class="perm-checkbox-row">
            <input type="checkbox" name="${p}" ${role?.permissions?.[p] ? 'checked' : ''} />
            ${PERM_LABELS[p]}
        </label>`).join('');

    container.innerHTML = `
        <div class="role-form">
            <div class="settings-label" style="margin-top:12px;">${role ? 'Edit Role' : 'New Role'}</div>
            <input class="modal-name-input" id="roleNameInput" type="text" placeholder="Role name (e.g. Scorer)"
                   value="${role ? esc(role.name) : ''}" style="margin-bottom:8px;width:100%;" />
            <div class="perm-checkboxes" id="rolePermCheckboxes">${permsHTML}</div>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="modal-btn-save" style="flex:1;" onclick="saveRoleForm('${role ? esc(role.id) : ''}')">
                    ${role ? 'Save Changes' : 'Create Role'}
                </button>
                <button class="modal-btn-cancel" onclick="document.getElementById('roleFormContainer').innerHTML=''">Cancel</button>
            </div>
        </div>`;
}

async function saveRoleForm(roleId) {
    const nameInput = document.getElementById('roleNameInput');
    const name = nameInput?.value.trim();
    if (!name) { alert('Please enter a role name.'); return; }

    const permissions = {};
    ALL_PERMS.forEach(p => {
        const cb = document.querySelector(`#rolePermCheckboxes input[name="${p}"]`);
        permissions[p] = cb?.checked || false;
    });

    try {
        if (roleId) {
            await updateRole(roleId, name, permissions);
        } else {
            await createRole(name, permissions);
        }
        _renderRolesPanel();
    } catch (e) {
        alert('Error saving role: ' + e.message);
    }
}

async function confirmDeleteRole(roleId, roleName) {
    if (!confirm(`Delete role "${roleName}"? Members with this role will become unassigned.`)) return;
    try {
        await deleteRole(roleId);
        _renderRolesPanel();
    } catch (e) {
        alert('Error deleting role: ' + e.message);
    }
}

async function applyMemberRole(userId, roleId) {
    try {
        await assignMemberRole(userId, roleId || null);
    } catch (e) {
        alert('Error assigning role: ' + e.message);
    }
}

async function kickMember(userId, name) {
    if (!confirm(`Remove ${name} from the club?`)) return;
    const { error } = await supabaseClient
        .from('club_members')
        .delete()
        .eq('club_id', currentClub.id)
        .eq('user_id', userId);
    if (error) { alert('Error kicking member: ' + error.message); return; }
    _rolesPanelMembers = _rolesPanelMembers.filter(m => m.user_id !== userId);
    _renderMembersPanel();
}
