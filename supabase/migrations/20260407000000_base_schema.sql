-- Base schema for padel-score.
-- Uses IF NOT EXISTS throughout so it is safe to run against the live
-- database (where tables already exist) and fresh preview environments.

-- ── profiles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username     TEXT UNIQUE,
    display_name TEXT,
    email        TEXT,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── clubs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    owner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE DEFAULT upper(left(replace(gen_random_uuid()::text, '-', ''), 6)),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── club_roles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID REFERENCES clubs(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    permissions JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── club_members ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_members (
    user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id   UUID REFERENCES clubs(id) ON DELETE CASCADE,
    role_id   UUID REFERENCES club_roles(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, club_id)
);

-- ── matches ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date       TIMESTAMPTZ NOT NULL,
    format     TEXT NOT NULL DEFAULT '2v2',
    team_a     TEXT[] NOT NULL,
    team_b     TEXT[] NOT NULL,
    score_a    INTEGER NOT NULL,
    score_b    INTEGER NOT NULL,
    club_id    UUID REFERENCES clubs(id) ON DELETE CASCADE,
    owner_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
