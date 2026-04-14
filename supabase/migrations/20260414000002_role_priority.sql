-- ─── Role Priority ──────────────────────────────────────────────────────────
-- Adds a priority column to club_roles.
-- Lower value = higher authority (owner is effectively priority 0).
-- Users may only edit/delete roles with strictly higher priority than their own,
-- and may only assign roles with strictly higher priority than their own.
-- Default roles are seeded with gaps so custom roles can be inserted in between.

ALTER TABLE club_roles
    ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 99;
