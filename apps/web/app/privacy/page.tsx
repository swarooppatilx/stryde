import type { Metadata } from 'next';
import { LegalPage, SupportContact } from '../_components/legal/LegalPage';

export const metadata: Metadata = { title: 'Privacy | Stryde' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="November 2026">
      <p>
        This page explains what Stryde collects, where it goes and what you can do about it. Stryde
        is a fitness app whose social and activity records are partly stored on public networks,
        which limits what can be erased. We say where below.
      </p>

      <h2>What the app collects</h2>
      <ul>
        <li>
          <strong>Account:</strong> the email address you sign in with, and the account address
          created for you at sign-up. Your username, name, gender, birthday and picture are the
          details you enter in your profile.
        </li>
        <li>
          <strong>Location:</strong> while you record an activity the app reads your location,
          including in the background (with a notification showing) so a recording continues with
          the screen off. Recording stops collecting when you finish. Location is not collected
          otherwise.
        </li>
        <li>
          <strong>Activities:</strong> the route, distance, time, splits, elevation, heart rate and
          steps from your recording, plus notes, gear and goals you add. Steps come from the phone
          motion sensor.
        </li>
        <li>
          <strong>Health data:</strong> if you allow it, the app reads workouts, distance, exercise
          routes, heart rate, resting heart rate, calories, weight and height from Health Connect.
          This is read only: Stryde never writes to your health data, and it does not use it for
          advertising.
        </li>
        <li>
          <strong>Photos:</strong> pictures you attach to an activity or post, and an avatar you
          choose.
        </li>
        <li>
          <strong>Notifications:</strong> a push token for your phone, so we can tell you about
          kudos, comments and follows.
        </li>
        <li>
          <strong>Identity check:</strong> if you verify with World ID, the result of that check.
        </li>
        <li>
          <strong>Social activity:</strong> who you follow, posts, bio and location text, likes on
          comments and reports you file.
        </li>
        <li>
          <strong>Live sharing:</strong> when you share a live link, your position and pace are
          published for about ten minutes after the last update.
        </li>
      </ul>
      <p>
        The app contains no advertising or analytics software and no crash-reporting service.
        Activities, settings, gear and goals are also kept on your phone.
      </p>

      <h2>Where it goes</h2>
      <ul>
        <li>
          <strong>Public records:</strong> a saved activity is written to a public blockchain
          (currently a test network), and social items such as follows, posts and about text are
          written to a public data network. Anyone can read them. A route you publish has the start
          and end hidden if you chose that, and your privacy zones are cut out. Activities set to
          Only Me are not published.
        </li>
        <li>
          <strong>Photos:</strong> uploaded to IPFS through Pinata. IPFS content is public and
          anyone with the link can fetch it.
        </li>
        <li>
          <strong>Service providers:</strong> Privy (sign-in and account), Mapbox (maps, route
          directions and place search: the area or route you look at is sent), Open-Meteo (weather
          and elevation for coordinates), Expo (push delivery), World (identity check) and the
          Stryde server, which relays your signed actions.
        </li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>Export your data from Data in the app.</li>
        <li>
          Turn off notifications, background location or Health Connect in your phone settings.
        </li>
        <li>Delete your account and data; see the delete account page.</li>
      </ul>
      <p>
        What is already on a public blockchain or IPFS cannot be erased by us or anyone else.
        Deleting your account removes what the Stryde server wrote for you on the data network and
        everything on your phone, but not the public records described above.
      </p>

      <h2>Children</h2>
      <p>Stryde is not meant for children under 13, and we do not knowingly collect their data.</p>

      <h2>Contact</h2>
      <p>
        Questions about this page: <SupportContact />.
      </p>
    </LegalPage>
  );
}
