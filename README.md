# Recycle Connect

A community app for the Lake Chapala (Lakeside) area: neighbors request a pickup for their
recyclables, and volunteer drivers claim the request, collect it, and deliver it to the
**Ajijic Recycling Center**. Bilingual (Spanish / English). A service to support Ajijic Recycling Center.

Built with Expo (React Native, SDK 57) + Expo Router, backed by Supabase. One codebase ships as:

- **Android app**: an APK built locally, downloadable from [Releases](https://github.com/usmcatl/recycling-app/releases).
- **Mobile web app** for iPhone and everyone else: https://usmcatl.github.io/recycling-app/
  (in Safari, tap Share → *Add to Home Screen* to get an app icon and full-screen view).

## How it works

Pickups run on **community route days**, like Ridwell: each community is collected on one
weekday (Ajijic on Tuesdays, Chapala on Thursdays, …). Donors sign up for an upcoming route day
until **8:00 PM the night before**, when sign-up closes so the driver can plan; a donor who misses it
is told so and their pickup goes on next week's route. A driver takes the whole route, either for one
day or **every week**, the way Olio volunteers hold collection slots. From 6 PM the night before,
open routes that have donors but no driver are flagged to drivers as "Needs a driver tonight".

**Donors**
1. Sign in or create an account with an emailed 6-digit code (no passwords) and agree to the
   code of conduct.
2. Set up a profile: name, email, WhatsApp, community (which sets the route day), and pickup address.
3. Request a pickup: materials (including mixed recyclables and books) → route date →
   **leave at the door** (default; no need to be home, the driver photographs the bags) or
   **hand over in person** → number of bags, up to the route driver's limit (3 by default).
4. Follow the request: driver assigned → route in progress (live map) → collected → delivered.
5. Give private feedback on the driver (a few yes/no questions and an optional note) and see
   history, badges and the leaderboard.

**Drivers (RecycleDrive)**
1. Browse upcoming routes and take a day, or hold a community **every week**. Weekly routes
   are assigned automatically as donors sign up. Cancel a day if needed. Each driver sets the most
   bags they'll take per stop.
2. On the route day, start the route. Stops are ordered by distance from the recycling center.
3. At each stop: **doorstep** means take a photo of the bags, enter the weight, and mark collected.
   **In person** means tap *I've arrived*; a no-show can only be recorded after waiting 5 minutes
   *and* calling or messaging the donor.
4. Deliver everything to the center, then give feedback on each donor.

There is no online/offline switch: donors see the driver's location only while the route is in
progress, and it is removed when the route is completed.

Anyone can switch between **Donor** and **Driver** from the top of either app; every inner screen
has a **Home** button.

**Trust**: everyone has a visible record that is counted automatically: completed pickups, missed
pickups, and late cancellations (a donor or driver cancelling after the 8 PM cutoff). Feedback
answers are private: only the person who gave them can read them, and a coordinator role (not built
yet) will review them.

Stop lifecycle: `open → claimed → en_route → picked_up → deposited`
(plus `cancelled` by the donor or `no_show` by the driver). Route lifecycle:
`open → claimed → in_progress → completed`.

The route-day schedule, cutoff hour, default bag limit and wait time live in `src/lib/constants.ts`
(the schedule is mirrored in the `route_schedule` table). **The days are placeholders until the
recycling center confirms when it receives deliveries.**

## Running it

```bash
npm install
npx expo start --web
```

With no Supabase keys configured the app runs in **demo mode**: sample Lakeside data is stored
on the device, any email signs in, and any 6-digit code works. A blue banner marks demo mode.
To help testers reach every step, demo mode adds a "simulate a completed pickup" button on a
donor's request and lets drivers start a route before its day.
Maps use OpenStreetMap, so no API key is needed.

## Publishing the mobile web version

```bash
npm run deploy:web
```

This exports the web build to `dist/` and pushes it to the `gh-pages` branch, which GitHub Pages
serves at https://usmcatl.github.io/recycling-app/.

## Installing the APK (Android)

Download `recycle-connect-<version>.apk` from the repo's
[Releases](https://github.com/usmcatl/recycling-app/releases) page on the phone, open it, and
allow "install unknown apps" when asked.

## Building the APK yourself

Everything builds locally. No Expo or other accounts are needed. Requirements: JDK 17 and the
Android SDK (`ANDROID_HOME`, e.g. `%LOCALAPPDATA%\Android\Sdk`).

```bash
npm install
npm run build:apk
```

On Windows, build from a short folder path such as `C:\rc` (for example
`git worktree add C:\rc <branch>` followed by `npm ci` there). The Android native build creates
paths longer than Windows' 260-character limit when the project sits deep under `C:\Users\…`.

The APK lands in `android/app/build/outputs/apk/release/app-release.apk`. It's signed with the
debug key, which is fine for testing and sideloading. Use a real release key before publishing
to the Play Store. If `.env.local` has Supabase keys at build time, they're baked into the APK;
otherwise it runs in demo mode.

## Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   It creates the tables, row-level security, the route/stop/rating functions, the private
   `pickup-photos` storage bucket, the leaderboard, and the realtime publication.
   `npm run test:db` runs the schema against an in-memory Postgres and checks the rules
   (cutoffs, bag limit, photo and wait-before-no-show, location sharing, who can see feedback).
3. **Authentication → Email templates → Magic Link**: include the code so users can type it, e.g.
   `Your Recycle Connect code: {{ .Token }}`. Then set up a custom SMTP sender under
   *Authentication → SMTP*; the built-in sender is heavily rate-limited.
4. Copy `.env.example` to `.env.local` and fill in `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API).
5. Restart `npx expo start`.

### Security model

- Donors see only their own requests. Drivers see open requests plus the ones they hold.
- A donor's WhatsApp number is visible only to the driver who accepted their request, and vice versa.
- Status changes go through `claim_request`, `release_request`, `advance_request`, and
  `cancel_request` (security-definer functions), so two drivers can't claim the same request and
  statuses can't skip steps.
- The leaderboard exposes only first name + last initial.

## Project layout

```
src/app/            screens (Expo Router)
  index.tsx           welcome / role choice
  sign-in.tsx         email code sign-in
  profile-setup.tsx   donor & driver profile
  (donor)/            Home · Activity · Impact · Account tabs
  (driver)/           Routes · Map · History · Account tabs
  request/            3-step pickup request
  confirmed/[id]      request received
  status/[id]         donor's live request status
  case/[id]           driver's pickup details & actions
src/components/      UI kit (design tokens from the Stitch mockup), map, tab bar
src/lib/             api (Supabase + demo), types, constants, formatting
src/i18n/            es / en strings
supabase/migrations/ database schema
```

Design tokens follow the mockup's "Curated Earth" system (`src/theme.ts`): Manrope + Inter,
tonal surfaces instead of divider lines, gradient primary buttons.

## Before launch

- [ ] Set the recycling center's real address and coordinates: `RECYCLING_CENTER` in `src/lib/constants.ts`.
- [ ] Set the support email: `SUPPORT_EMAIL` in `src/lib/constants.ts`.
- [ ] Push / WhatsApp notifications: preferences are saved, but sending them needs a server-side
      job (e.g. a Supabase Edge Function + Expo Push / WhatsApp Business API).
- [ ] Create a release signing key before publishing to the Play Store.
