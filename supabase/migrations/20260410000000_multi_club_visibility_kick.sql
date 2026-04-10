-- ─── 1. Add visibility column to clubs ─────────────────────────────────────
ALTER TABLE clubs
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public_invite'
    CHECK (visibility IN ('public', 'public_invite', 'private'));

-- ─── 2. Enable RLS on clubs ──────────────────────────────────────────────────
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clubs_select ON clubs;
DROP POLICY IF EXISTS clubs_insert ON clubs;
DROP POLICY IF EXISTS clubs_update ON clubs;
DROP POLICY IF EXISTS clubs_delete ON clubs;

-- Discoverable clubs (public / public_invite) are visible to all authenticated users.
-- Private clubs are visible only to the owner and existing members.
CREATE POLICY clubs_select ON clubs FOR SELECT TO authenticated
    USING (
        owner_id = auth.uid()
        OR visibility IN ('public', 'public_invite')
        OR EXISTS (
            SELECT 1 FROM club_members
            WHERE club_id = clubs.id AND user_id = auth.uid()
        )
    );

-- Any authenticated user may create a club (owner_id must equal caller).
CREATE POLICY clubs_insert ON clubs FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Only the club owner may update club settings.
CREATE POLICY clubs_update ON clubs FOR UPDATE TO authenticated
    USING  (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Only the club owner may delete the club.
CREATE POLICY clubs_delete ON clubs FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- ─── 3. SECURITY DEFINER: invite-code lookup ─────────────────────────────────
-- Bypasses clubs RLS so private-club invite codes can still be resolved.
CREATE OR REPLACE FUNCTION get_club_by_invite_code(code TEXT)
RETURNS SETOF clubs
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
    SELECT * FROM clubs WHERE invite_code = upper(code) LIMIT 1;
$$;

-- ─── 4. SECURITY DEFINER: kick_members permission check ──────────────────────
CREATE OR REPLACE FUNCTION user_has_kick_members_in_club(p_club_id UUID)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1
        FROM club_members cm
        JOIN club_roles cr ON cr.id = cm.role_id
        WHERE cm.club_id = p_club_id
          AND cm.user_id = auth.uid()
          AND (cr.permissions->>'kick_members')::boolean = true
    );
$$;

-- ─── 5. Extend club_members DELETE to include kick_members holders ────────────
DROP POLICY IF EXISTS club_members_delete ON club_members;

CREATE POLICY club_members_delete ON club_members FOR DELETE TO authenticated
    USING (
        -- member can always leave themselves
        user_id = auth.uid()
        -- club owner can remove anyone
        OR EXISTS (
            SELECT 1 FROM clubs
            WHERE id = club_members.club_id AND owner_id = auth.uid()
        )
        -- members with kick_members permission can remove others
        OR user_has_kick_members_in_club(club_members.club_id)
    );

-- ─── 6. Enable RLS on matches ────────────────────────────────────────────────
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS matches_select ON matches;
DROP POLICY IF EXISTS matches_insert ON matches;
DROP POLICY IF EXISTS matches_update ON matches;
DROP POLICY IF EXISTS matches_delete ON matches;

-- Any club member may read matches.
CREATE POLICY matches_select ON matches FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members
            WHERE club_id = matches.club_id AND user_id = auth.uid()
        )
    );

-- Club members may insert their own matches.
CREATE POLICY matches_insert ON matches FOR INSERT TO authenticated
    WITH CHECK (
        owner_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM club_members
            WHERE club_id = matches.club_id AND user_id = auth.uid()
        )
    );

-- Match owner or club owner may update.
CREATE POLICY matches_update ON matches FOR UPDATE TO authenticated
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM clubs
            WHERE id = matches.club_id AND owner_id = auth.uid()
        )
    )
    WITH CHECK (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM clubs
            WHERE id = matches.club_id AND owner_id = auth.uid()
        )
    );

-- Match owner or club owner may delete.
CREATE POLICY matches_delete ON matches FOR DELETE TO authenticated
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM clubs
            WHERE id = matches.club_id AND owner_id = auth.uid()
        )
    );
