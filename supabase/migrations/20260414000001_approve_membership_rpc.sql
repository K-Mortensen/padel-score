-- ─── Approve membership request via SECURITY DEFINER ─────────────────────────
-- The club_members INSERT policy only allows users to add themselves.
-- This function bypasses that restriction for club owners and members with
-- the approve_requests permission, so they can approve membership requests.

CREATE OR REPLACE FUNCTION approve_club_membership_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_club_id UUID;
    v_user_id UUID;
    v_default_role_id UUID;
    v_is_owner BOOLEAN;
    v_can_approve BOOLEAN;
BEGIN
    -- Fetch request details
    SELECT club_id, user_id
      INTO v_club_id, v_user_id
      FROM club_membership_requests
     WHERE id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed.';
    END IF;

    -- Check caller has permission: owner OR approve_requests role
    SELECT owner_id = auth.uid()
      INTO v_is_owner
      FROM clubs
     WHERE id = v_club_id;

    v_can_approve := v_is_owner OR user_has_approve_requests_in_club(v_club_id);

    IF NOT v_can_approve THEN
        RAISE EXCEPTION 'Permission denied.';
    END IF;

    -- Get the club default role
    SELECT default_role_id
      INTO v_default_role_id
      FROM clubs
     WHERE id = v_club_id;

    -- Add the requester to club_members (ignore if already a member)
    INSERT INTO club_members (club_id, user_id, role_id)
    VALUES (v_club_id, v_user_id, v_default_role_id)
    ON CONFLICT (user_id, club_id) DO NOTHING;

    -- Mark the request as approved
    UPDATE club_membership_requests
       SET status = 'approved'
     WHERE id = p_request_id;
END;
$$;
