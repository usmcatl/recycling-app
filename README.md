# Recycle Connect

A community app for the Lake Chapala (Lakeside) area: neighbors request a pickup for their
recyclables, and volunteer drivers claim the request, collect it, and deliver it to the
**Ajijic Recycling Center**. Bilingual (Spanish / English).

Built with Expo (React Native, SDK 57) + Expo Router, backed by Supabase.

## How it works

**Donors**
1. Sign in with an emailed 6-digit code (no passwords).
2. Set up a profile: name, WhatsApp, community, pickup address (optionally pinned with GPS).
3. Request a pickup in three steps: materials → day & time window → bags, instructions, address.
4. Follow the request live: driver assigned → on the way (with map) → collected → delivered.
5. See their history, badges, and the community leaderboard (kg diverted).

**Drivers (RecycleDrive)**
1. Go **Active** to appear online and share location; **Offline** hides them.
2. See open requests on a map and in a list sorted by distance, then accept one.
3. Call / WhatsApp the donor (contact details appear only after accepting).
4. Mark *on my way* → *collected* (enter weight in kg) → *delivered to the center*.
   Or hand the pickup back, or report that it couldn't be collected.

Request lifecycle: `open → claimed → en_route → picked_up → deposited`
(plus `cancelled` by the donor or `no_show` by the driver).

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on a phone. With no Supabase keys configured the app runs in
**demo mode**: sample Lakeside data is stored on the device, any email signs in, and any
6-digit code works. A blue banner marks demo mode.

`npx expo start --web` gives a quick browser preview; the map is replaced by a placeholder there.

## Building a test APK (Android)

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

The first run links the project to your Expo account (free) and generates a signing key. EAS
builds in the cloud and gives you a link / QR code to download the `.apk`, which installs on any
Android phone (allow "install unknown apps"). Without Supabase keys in the build, the APK runs in
demo mode. To build against Supabase, add the two `EXPO_PUBLIC_SUPABASE_*` values as EAS
environment variables (`npx eas-cli@latest env:create`) for the `preview` environment.

## Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   It creates the tables, row-level security, the status-change functions, the leaderboard, and
   the realtime publication.
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
- [ ] Add a square app icon (1024×1024) at `assets/icon.png` and update the Android adaptive icons.
- [ ] Android builds: add a Google Maps API key (`android.config.googleMaps.apiKey` in `app.json`).
- [ ] Push / WhatsApp notifications: preferences are saved, but sending them needs a server-side
      job (e.g. a Supabase Edge Function + Expo Push / WhatsApp Business API).
- [ ] Build and publish with EAS: `npx eas-cli@latest build`.
