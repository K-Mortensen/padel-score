# Firematch · Padel

A mobile-first web app for recording padel matches, building fair teams and
tracking an Elo ladder per club. It's a static site (no build step) served by
GitHub Pages, with data in Supabase.

## Features
- **Play**: put players on a court, then shuffle, balance by rating, or swap sides. Enter the score with big +/- buttons and see the win chance and rating change before you save.
- **Matches**: history grouped by month, filtered by mine, doubles or singles. Tap a match to see rating changes, edit it or delete it.
- **Ranking**: a podium plus the ladder for doubles and singles, with form, provisional players, and a player profile showing a rating chart, streaks, best partner and toughest opponent.
- **Club**: an invite code and share link (`?invite=CODE`), members, roles and permissions, join requests, browsing clubs, switching between several clubs, and owner settings.
- Light and dark themes (follows the system by default). The app can be installed to the home screen.

## Structure
```
index.html            app shell
css/app.css           all styles (tokens on :root, dark theme overrides)
js/config.js          Supabase client + constants
js/state.js           shared state, identity + permission helpers
js/api.js             every Supabase query/RPC
js/elo.js             Elo engine + stats (derived from matches, cached)
js/ui.js              icons, avatars, sheets, dialogs, toasts
js/views/*.js         play, matches, rankings, club, profile
js/main.js            boot, auth screens, routing, event delegation
supabase/migrations   database schema + RLS (unchanged)
```

## Run locally
Any static server works, for example:
```
python3 -m http.server 8080
```
Google sign-in redirects back to the current URL, so add your local origin to
the Supabase auth redirect allow-list if you want to log in locally.
