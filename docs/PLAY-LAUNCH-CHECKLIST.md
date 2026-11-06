# Google Play launch checklist

Draft, pending owner approval. Every item below is an OWNER task unless it says otherwise. The legal pages in `apps/web` (privacy, terms, delete-account, support) are drafts too and need the owner's review before the store listing points to them.

## 0. Data inventory (what the code really collects)

Used for the data-safety form and the privacy page. Re-check it whenever a feature changes.

| Data | Why | Where it goes |
| --- | --- | --- |
| Email (Privy login), account address | Sign in, identify the account | Privy; the address is public on the network |
| Name, username, gender, birthday, avatar, bio and location text | Profile | Phone; bio and location text on the public data network |
| Precise location, including background | Record routes | Phone; the route is published with privacy zones cut out unless the activity is Only Me |
| Route, distance, time, elevation, heart rate, steps | Activity records | Phone; published activities go to a public blockchain (test network) and the data network |
| Health Connect (read only): exercise, distance, exercise routes, heart rate, resting heart rate, calories, weight, height | Import workouts, zones, calorie estimates | Phone; imported workouts follow the activity rules above |
| Photos | Activity and post pictures | IPFS through Pinata (public) |
| Follows, posts, comment likes, reports | Social features | Public data network, written by the Stryde server |
| Push token | Notifications | Stryde server (public data network), Expo push service |
| World ID result | Identity check | World; result kept on the account |
| Live sharing position | Live link | Public data network, expires about 10 minutes after the last update |
| Map area, route being planned, coordinates | Maps, directions, place search, weather, elevation | Mapbox, Open-Meteo |

No advertising SDK, analytics SDK or crash reporter is installed. Verify with `grep` on `apps/mobile/package.json` before submitting.

## 1. Permissions declarations (Play Console, App content)

Blocked in `app.json` (`android.blockedPermissions`): RECORD_AUDIO (added by the image picker plugin, no recording exists), READ_MEDIA_AUDIO, READ_MEDIA_VIDEO (added by the media library plugin, only photos are used), SYSTEM_ALERT_WINDOW (development overlay). Confirm in the built bundle's merged manifest.

### Health Connect declaration
Requested read permissions: exercise, distance, exercise routes, heart rate, total calories burned, weight, height, resting heart rate. All read only.

Justification text:
> Stryde lets athletes import workouts recorded by their watch or another app, so their training history is in one place. We read exercise sessions, distance and routes to create activities, heart rate and calories to show effort and zones, and weight, height and resting heart rate to estimate calories and heart-rate zones. Data is read only when the user taps Import or enables automatic import, is never written back to Health Connect, is not sold, and is not used for advertising.

Also needed: a privacy policy URL that mentions Health Connect (the privacy page does), and a screen recording of the permission flow.

### Foreground service (location)
Permission: FOREGROUND_SERVICE_LOCATION.

Justification text:
> While the user is recording a run, ride or walk, Stryde keeps a foreground service with a visible notification so the route and distance continue to be recorded when the screen is off or the app is in the background. The service starts only when the user taps Start and stops when they finish.

### Background location
Permission: ACCESS_BACKGROUND_LOCATION.

Justification text:
> Recording an activity must continue while the phone is locked or another app (music, maps) is in front. Location is collected only during a recording the user started, is shown to them through a persistent notification, and stops when the recording ends. The app cannot record routes without it.

Demo video outline (about 60 seconds, unlisted YouTube link):
1. Open the app, show the in-app location explanation, grant location (and "Allow all the time").
2. Tap Start, show the recording notification, lock the screen for 10 seconds.
3. Unlock, show the distance and route kept growing, tap Finish, save.
4. Show Settings, Recording, and where permission can be withdrawn.

### Activity recognition
ACTIVITY_RECOGNITION is used for the step counter during tracking. Describe it the same way if the form asks.

## 2. Data safety form answers

Derived from section 0. Collected, not sold. Encrypted in transit: yes. Deletion: yes, in the app (Data, Delete my account) and at the delete-account web page; state that public records cannot be erased.

- Location, precise: collected, required for recording, shared with Mapbox only as map requests (area or route), not shared otherwise. Purpose: app functionality.
- Health and fitness (exercise, heart rate, weight, height): collected, optional, purpose app functionality, not shared.
- Personal info: name, email, user IDs: collected, purpose account management and app functionality. Email is shared with Privy (service provider).
- Photos: collected, optional, public through IPFS.
- Messages and posts (user-generated content): collected, public.
- App activity: follows and likes, collected, public.
- Device or other IDs: push token, collected, shared with Expo (service provider).
- Financial info: none. Contacts, calendar, audio, files: none.
- Crash logs and diagnostics: none collected.

## 3. Content rating notes

- User-generated content and photos: yes, with reporting and blocking inside the app.
- Location sharing with others: yes (live link, published routes).
- Challenges mention a stake: tokens are on a test network with no cash value. Check the real-money gambling and rewards policy before answering "no" to gambling and decide whether the stake feature should be hidden in the Play build. OWNER decision.
- No violence, sexual content, drugs or ads.

## 4. Push setup

1. EAS projectId is already in `app.json` (`extra.eas.projectId`). Confirm it belongs to the production account.
2. Create a Firebase project, add the Android app `com.stryde.app`, download `google-services.json`, then upload the FCM v1 service account key with `eas credentials` (Android, Push Notifications). Do not commit the file.
3. Create an Expo access token and set `EXPO_ACCESS_TOKEN` on the API host.
4. Set `CRON_SECRET` on the API host and in the scheduler that calls `/api/maintenance`.
5. Send a test push to a release build.

## 5. Signing

1. First `eas build --platform android --profile production` lets EAS generate the upload keystore. Download a backup with `eas credentials` and store it in a password manager. Never commit `.jks` files.
2. In Play Console enrol in Play App Signing, upload the first AAB, and register the upload key.
3. Create a Play service account with release permission and add its JSON key to EAS (`eas submit` prompts) for `eas submit --platform android --profile production` (internal track, draft).
4. Keep `appVersionSource: remote` so version codes increase.

## 6. Mapbox download token

`@rnmapbox/maps` needs a secret token with the Downloads:Read scope at build time. Create it at mapbox.com, then `eas env:create --environment production --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN --visibility secret`. The runtime public token is `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (starts with `pk.`).

## 7. Secrets and variables per environment

EAS production environment (app, public values, plain text): `EXPO_PUBLIC_PRIVY_APP_ID`, `EXPO_PUBLIC_PRIVY_CLIENT_ID`, `EXPO_PUBLIC_API_KEY`, `EXPO_PUBLIC_WORLD_APP_ID`, `EXPO_PUBLIC_WORLD_RP_ID`, `EXPO_PUBLIC_WORLD_ENVIRONMENT`, `EXPO_PUBLIC_FACEBOOK_APP_ID`, `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, `EXPO_PUBLIC_WEB_URL` (the site that hosts the legal pages; the About rows only show when it is set). `EXPO_PUBLIC_CHAIN_MODE` and `EXPO_PUBLIC_API_URL` are in the production profile of `eas.json`. EAS secret: `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`.

GitHub Actions secrets (for the AAB job, run by hand): `EXPO_ACCESS_TOKEN` and the `EXPO_PUBLIC_*` values above.

API host (Vercel), secrets: `API_KEY`, `ARKIV_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `RELAYER_PRIVATE_KEY`, `RELAYER_RPC_URL`, `RELAYER_CHAIN_ID`, `PINATA_API_KEY`, `PINATA_SECRET_KEY`, `EXPO_ACCESS_TOKEN`, `CRON_SECRET`, `WORLD_RP_SIGNING_KEY`, `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_ENVIRONMENT`, `CORS_ORIGIN`. Check `packages/api/.env.example` for the full list and for the optional ones.

Web host: `NEXT_PUBLIC_SUPPORT_EMAIL` (the support address shown on the legal pages; the pages say it is not published yet while it is empty), plus the existing `NEXT_PUBLIC_*` values.

## 8. Before pressing publish

- Replace the draft legal text with the owner-approved text and set the support email.
- Add the privacy policy and delete-account URLs in Play Console (App content, Data deletion).
- Internal testing first, then closed testing with the required tester count for new personal accounts.
- Store listing, screenshots, feature graphic and short description.
