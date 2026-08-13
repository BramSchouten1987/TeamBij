# Holiday 2026 app — setup (10 minutes, one-time)

The app itself is done and tested. Two short steps turn it from "just on my
phone" into "live, shared, and on both our home screens."

## 1. Put the data online (2 min, free, no credit card)

This is what lets you and your partner see the same choices update live.

1. Go to **supabase.com** → Start your project → sign in with Google/GitHub.
2. Create a new project (any name, e.g. "holiday-2026"). Pick any region — it
   doesn't matter for this.
3. Once it's created, open the **SQL Editor** (left sidebar) → New query →
   paste this and click Run:

   ```sql
   create table itinerary_days (
     date date primary key,
     answers jsonb,
     chosen_id text,
     note text,
     updated_by text,
     updated_at timestamptz default now()
   );
   alter table itinerary_days enable row level security;
   create policy "public read" on itinerary_days for select using (true);
   create policy "public write" on itinerary_days for insert with check (true);
   create policy "public update" on itinerary_days for update using (true);
   alter publication supabase_realtime add table itinerary_days;
   ```

4. Go to **Project Settings → API**. You need two values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`)

   Note on privacy: this makes the trip data readable/writable to anyone who
   has both values — same level of "privacy" as a shared Google Doc link.
   Fine for holiday plans; don't reuse this project for anything sensitive.

## 2. Add live Google ratings & travel time (optional, ~10 min, needs a card on file)

Everything else in the app works with zero setup — every activity already
has a "Google Maps" and "Directions" link. This step is only for showing a
live star rating (with review count) and drive time/distance from your stay
directly on each activity card.

1. Go to **console.cloud.google.com** → create a new project (any name, e.g.
   "holiday-2026").
2. **APIs & Services → Library** → search for and enable each of these three:
   - **Maps JavaScript API**
   - **Places API (New)**
   - **Distance Matrix API (Legacy)**
3. **APIs & Services → Credentials → Create Credentials → API key.** Copy the
   key it gives you.
4. Click into the new key → under **Application restrictions** choose
   **Websites** and add:
   ```
   https://bramschouten1987.github.io/*
   ```
   This stops anyone else from using your key even if it ends up in the
   page source (which it will — that's normal for this kind of key).
5. **Billing:** Google requires a card on file to enable these APIs, unlike
   Supabase/Netlify. Personal use like this (a handful of lookups per day,
   for two people, for a few weeks) stays far inside the free monthly
   credit — you're not expected to actually be charged.
6. Paste the key into the app: **Settings (⚙︎) → Google Maps API key →
   Save & connect.** It's included automatically when you use "Copy share
   link for partner", so you only need to do this once.

## 3. The app is already online, and how to update it

The app is live at **bramschouten1987.github.io/TeamBij** — it deploys
automatically from the `main` branch of the GitHub repo. To make changes,
edit the files and push to `main`; GitHub Pages picks it up within a minute
or two. No manual re-upload step needed.

## 4. Connect and install

1. Open the app URL on your phone.
2. Tap the settings (⚙︎) icon → paste the Supabase URL and anon key from
   step 1 (and the Google Maps key from step 2, if you set one up) →
   **Save & connect**.
3. Tap **Copy share link for partner** and send it to your partner (WhatsApp,
   iMessage, whatever). When they open it once, their phone connects to the
   same shared trip (and picks up the Google Maps key, if set) automatically
   — no account needed on their end.
4. On both phones: open the site → share icon → **Add to Home Screen** (iOS)
   or the browser's **Install app** prompt (Android). You'll get a real app
   icon that opens full-screen, just like a native app.

## Editing the trip

Everything about the trip — stays, dates, activity options — lives in
`data.js`. It's plain, commented data, no build step:

- `STAYS`: your accommodation blocks. The **drive-home leg (Sep 9–11) has no
  booking yet** — it's marked `confirmed: false` with two unbooked overnight
  suggestions (`SUGGESTED_STOPOVERS`). Once you book something, just edit
  that entry.
- `OPTIONS`: the curated activities per region (Tyrol / Carinthia / Istria),
  each tagged by category, effort, weather-fit, and toddler-friendliness —
  this is what the daily question flow scores against.
- `QUESTIONS`: the daily question flow itself, if you want to change the
  questions asked.
- `mapsQuery` on each option: the search string used for its Google Maps
  link and (if you've set up a key) its live rating/distance lookup. Keep it
  specific (name + village/country) so it finds the right place.

After editing, commit and push to `main` — see step 3 above.

## What's real vs. inferred right now

- **Confirmed from your inbox:** Ehrwald (Hotel Spielmann, Aug 24–27),
  Heiligenblut (Hieserhof, Aug 27–Sep 2), Smoljanci/Istria (Villa-Osmium,
  Sep 2–9).
- **Not booked yet:** the drive home, Sep 9–11. The app shows two
  editable stopover suggestions (Salzburg-area or Nuremberg-area) — swap
  these for the real thing once it's booked.
