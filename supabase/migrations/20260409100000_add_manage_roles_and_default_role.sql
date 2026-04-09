-- Adds default_role_id to clubs and extends club_roles / club_members
-- write policies to also allow members with the manage_roles permission.
-- Apply in Supabase Dashboard → SQL Editor.

-- ── 1. Default role for new members ──────────────────────────────────────────
-- The club owner can pick a role that is auto-assigned to anyone who joins.
ALTER TABLE clubs
    ADD COLUMN IF NOT EXISTS default_role_id UUID REFERENCES club_roles(id) ON DELETE SET NULL;

-- ── 2. Extend club_roles write policies to allow manage_roles holders ─────────
-- Helper: true when the current user has a role with manage_roles = true
-- in the given club.  Used in USING / WITH CHECK expressions below.

DROP POLICY IF EXISTS club_roles_insert_owner ON club_roles;
CREATE POLICY club_roles_insert_owner
    ON club_roles FOR INSERT TO authenticated
    WITH CHECK (
        -- club owner
        EXISTS (SELECT 1 FROM clubs WHERE id = club_roles.club_id AND owner_id = auth.uid())
        OR
        -- member whose role grants manage_roles
        EXISTS (
            SELECT 1 FROM club_members cm
            JOIN club_roles cr ON cr.id = cm.role_id
            WHERE cm.club_id  = club_roles.club_id
              AND cm.user_id  = auth.uid()
              AND (cr.permissions->>'manage_roles')::boolean = true
        )
    );

DROP POLICY IF EXISTS club_roles_update_owner ON club_roles;
CREATE POLICY club_roles_update_owner
    ON club_roles FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_roles.club_id AND owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM club_members cm
            JOIN club_roles cr ON cr.id = cm.role_id
            WHERE cm.club_id  = club_roles.club_id
              AND cm.user_id  = auth.uid()
              AND (cr.permissions->>'manage_roles')::boolean = true
        )
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_roles.club_id AND owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM club_members cm
            JOIN club_roles cr ON cr.id = cm.role_id
            WHERE cm.club_id  = club_roles.club_id
              AND cm.user_id  = auth.uid()
              AND (cr.permissions->>'manage_roles')::boolean = true
        )
    );

DROP POLICY IF EXISTS club_roles_delete_owner ON club_roles;
CREATE POLICY club_roles_delete_owner
    ON club_roles FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_roles.club_id AND owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM club_members cm
            JOIN club_roles cr ON cr.id = cm.role_id
            WHERE cm.club_id  = club_roles.club_id
              AND cm.user_id  = auth.uid()
              AND (cr.permissions->>'manage_roles')::boolean = true
        )
    );

-- ── 3. Extend club_members UPDATE policy to allow manage_roles holders ────────
-- Role assignment (used by assignMemberRole) must also work for managers.
DROP POLICY IF EXISTS club_members_update_owner ON club_members;
CREATE POLICY club_members_update_owner
    ON club_members FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM club_members AS my_cm
            JOIN club_roles AS my_cr ON my_cr.id = my_cm.role_id
            WHERE my_cm.club_id = club_members.club_id
              AND my_cm.user_id = auth.uid()
              AND (my_cr.permissions->>'manage_roles')::boolean = true
        )
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM club_members AS my_cm
            JOIN club_roles AS my_cr ON my_cr.id = my_cm.role_id
            WHERE my_cm.club_id = club_members.club_id
              AND my_cm.user_id = auth.uid()
              AND (my_cr.permissions->>'manage_roles')::boolean = true
        )
    );
