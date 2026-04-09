-- Enable RLS on club_members and profiles.
-- Apply this in the Supabase Dashboard → SQL Editor.
--
-- club_members:
--   SELECT  → any authenticated user (rows only contain UUIDs; club_id is a
--             non-guessable UUID, so exposure risk is minimal)
--   INSERT  → users can add their own membership
--   UPDATE  → club owner can assign/change member roles
--   DELETE  → member can leave (their own row); club owner can remove members
--
-- profiles:
--   SELECT  → any authenticated user (display names / avatars are public within the app)
--   INSERT  → users can only insert their own profile
--   UPDATE  → users can only update their own profile

-- ══ club_members ═════════════════════════════════════════════════════════════

ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS club_members_select_authenticated ON club_members;
DROP POLICY IF EXISTS club_members_insert_own           ON club_members;
DROP POLICY IF EXISTS club_members_update_owner         ON club_members;
DROP POLICY IF EXISTS club_members_delete               ON club_members;

-- Any signed-in user can read club_members rows.
-- The app always filters by club_id, and club_ids are non-guessable UUIDs.
CREATE POLICY club_members_select_authenticated
    ON club_members FOR SELECT TO authenticated
    USING (true);

-- Users can only insert their own membership row.
CREATE POLICY club_members_insert_own
    ON club_members FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Only the club owner can update role assignments.
CREATE POLICY club_members_update_owner
    ON club_members FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
    );

-- Members can remove themselves; club owner can remove any member.
CREATE POLICY club_members_delete
    ON club_members FOR DELETE TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
    );

-- ══ profiles ═════════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_insert_own           ON profiles;
DROP POLICY IF EXISTS profiles_update_own           ON profiles;

-- Any authenticated user can read profiles (usernames / avatars shown in the UI).
CREATE POLICY profiles_select_authenticated
    ON profiles FOR SELECT TO authenticated
    USING (true);

CREATE POLICY profiles_insert_own
    ON profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_own
    ON profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
