-- Enable Row Level Security on club_roles.
-- Apply this in the Supabase Dashboard → SQL Editor.
--
-- Access model:
--   SELECT  → any authenticated member of the club (covers direct queries
--             and PostgREST FK-join reads from club_members.select('club_roles(*)'))
--   INSERT  → club owner only (clubs.owner_id = auth.uid())
--   UPDATE  → club owner only
--   DELETE  → club owner only
--
-- Note: club owners are always inserted into club_members on club creation
-- (js/club.js:54–56), so the member check covers owners for SELECT too.

ALTER TABLE club_roles ENABLE ROW LEVEL SECURITY;

-- ── SELECT ────────────────────────────────────────────────────────────────────
CREATE POLICY club_roles_select_member
    ON club_roles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM club_members cm
            WHERE cm.club_id = club_roles.club_id
              AND cm.user_id = auth.uid()
        )
    );

-- ── INSERT ────────────────────────────────────────────────────────────────────
CREATE POLICY club_roles_insert_owner
    ON club_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM clubs c
            WHERE c.id = club_roles.club_id
              AND c.owner_id = auth.uid()
        )
    );

-- ── UPDATE ────────────────────────────────────────────────────────────────────
-- USING restricts which rows can be targeted; WITH CHECK prevents reassigning
-- a role to a different club.
CREATE POLICY club_roles_update_owner
    ON club_roles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM clubs c
            WHERE c.id = club_roles.club_id
              AND c.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM clubs c
            WHERE c.id = club_roles.club_id
              AND c.owner_id = auth.uid()
        )
    );

-- ── DELETE ────────────────────────────────────────────────────────────────────
CREATE POLICY club_roles_delete_owner
    ON club_roles
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM clubs c
            WHERE c.id = club_roles.club_id
              AND c.owner_id = auth.uid()
        )
    );
