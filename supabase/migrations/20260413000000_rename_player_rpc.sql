-- Atomically renames a player in both their profile and all historical matches.
-- Called when a user changes their username in Settings.
-- SECURITY DEFINER so it can bypass RLS to update matches in all the user's clubs.

CREATE OR REPLACE FUNCTION update_username_and_matches(new_username TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    calling_user_id UUID := auth.uid();
    old_username TEXT;
BEGIN
    -- Resolve the caller's current username
    SELECT username INTO old_username FROM profiles WHERE id = calling_user_id;
    IF old_username IS NULL THEN
        RAISE EXCEPTION 'No current username found for this user';
    END IF;

    IF length(trim(new_username)) < 2 THEN
        RAISE EXCEPTION 'Username must be at least 2 characters';
    END IF;

    -- Update the profile (unique constraint on username will raise 23505 if taken)
    UPDATE profiles SET username = new_username WHERE id = calling_user_id;

    -- Propagate the rename to every match in clubs the user belongs to
    UPDATE matches
    SET
        team_a = array_replace(team_a, old_username, new_username),
        team_b = array_replace(team_b, old_username, new_username)
    WHERE club_id IN (
        SELECT club_id FROM club_members WHERE user_id = calling_user_id
    )
      AND (old_username = ANY(team_a) OR old_username = ANY(team_b));
END;
$$;
