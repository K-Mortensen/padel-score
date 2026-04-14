-- ─── Club Membership Requests ─────────────────────────────────────────────────
-- Allows users to request membership in invite-only clubs.
-- Club owners and members with approve_requests permission can approve/reject.

CREATE TABLE club_membership_requests (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id    UUID        NOT NULL REFERENCES clubs(id)      ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status     TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, club_id)
);

ALTER TABLE club_membership_requests ENABLE ROW LEVEL SECURITY;

-- Helper: check if the calling user has approve_requests permission in a club
CREATE OR REPLACE FUNCTION user_has_approve_requests_in_club(p_club_id UUID)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1
        FROM club_members cm
        JOIN club_roles cr ON cr.id = cm.role_id
        WHERE cm.club_id = p_club_id
          AND cm.user_id = auth.uid()
          AND (cr.permissions->>'approve_requests')::boolean = true
    );
$$;

-- SELECT: requester OR club owner OR member with approve_requests
CREATE POLICY cmr_select ON club_membership_requests FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM clubs
            WHERE id = club_membership_requests.club_id AND owner_id = auth.uid()
        )
        OR user_has_approve_requests_in_club(club_membership_requests.club_id)
    );

-- INSERT: any authenticated user may submit their own request
CREATE POLICY cmr_insert ON club_membership_requests FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- UPDATE: club owner OR member with approve_requests (to change status)
CREATE POLICY cmr_update ON club_membership_requests FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clubs
            WHERE id = club_membership_requests.club_id AND owner_id = auth.uid()
        )
        OR user_has_approve_requests_in_club(club_membership_requests.club_id)
    );

-- DELETE: the requester (cancel) OR owner OR approver (dismiss)
CREATE POLICY cmr_delete ON club_membership_requests FOR DELETE TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM clubs
            WHERE id = club_membership_requests.club_id AND owner_id = auth.uid()
        )
        OR user_has_approve_requests_in_club(club_membership_requests.club_id)
    );
