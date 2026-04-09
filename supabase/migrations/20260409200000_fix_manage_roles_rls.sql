-- Fix infinite recursion in club_roles RLS policies.
-- The previous policies joined back to club_roles inside a club_roles policy,
-- causing Postgres to detect infinite recursion (policy evaluates club_roles
-- → tries to find member's role → evaluates club_roles again → loop).
--
-- Solution: a SECURITY DEFINER function reads club_roles bypassing RLS,
-- breaking the recursion.

CREATE OR REPLACE FUNCTION user_has_manage_roles_in_club(p_club_id UUID)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1
        FROM club_members cm
        JOIN club_roles cr ON cr.id = cm.role_id
        WHERE cm.club_id = p_club_id
          AND cm.user_id = auth.uid()
          AND (cr.permissions->>'manage_roles')::boolean = true
    );
$$;

-- ── club_roles write policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS club_roles_insert_owner ON club_roles;
CREATE POLICY club_roles_insert_owner
    ON club_roles FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_roles.club_id AND owner_id = auth.uid())
        OR user_has_manage_roles_in_club(club_roles.club_id)
    );

DROP POLICY IF EXISTS club_roles_update_owner ON club_roles;
CREATE POLICY club_roles_update_owner
    ON club_roles FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_roles.club_id AND owner_id = auth.uid())
        OR user_has_manage_roles_in_club(club_roles.club_id)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_roles.club_id AND owner_id = auth.uid())
        OR user_has_manage_roles_in_club(club_roles.club_id)
    );

DROP POLICY IF EXISTS club_roles_delete_owner ON club_roles;
CREATE POLICY club_roles_delete_owner
    ON club_roles FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_roles.club_id AND owner_id = auth.uid())
        OR user_has_manage_roles_in_club(club_roles.club_id)
    );

-- ── club_members UPDATE policy ────────────────────────────────────────────
-- Role assignment must also work for members with manage_roles permission.
DROP POLICY IF EXISTS club_members_update_owner ON club_members;
CREATE POLICY club_members_update_owner
    ON club_members FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
        OR user_has_manage_roles_in_club(club_members.club_id)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
        OR user_has_manage_roles_in_club(club_members.club_id)
    );
