import type { Metadata } from 'next';
import { LegalPage, SupportContact } from '../_components/legal/LegalPage';

export const metadata: Metadata = { title: 'Delete your account | Stryde' };

export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your account and data" updated="November 2026">
      <h2>In the app</h2>
      <ol>
        <li>Open Settings, then Data.</li>
        <li>Choose Export my data first if you want a copy.</li>
        <li>Under Danger zone choose Delete my account and type the confirmation word.</li>
      </ol>
      <p>
        If your phone is offline the request waits in the app and is sent when you are back online.
        Stay signed in until it has been sent: the app needs your account to sign it.
      </p>

      <h2>What gets removed</h2>
      <ul>
        <li>
          On the Stryde server&apos;s data network: your follows in both directions, posts, bio and
          location text, likes on comments, reports you filed, push tokens and live sharing
          positions. The app tells you how many of each were removed.
        </li>
        <li>
          On your phone: activities, routes, notes, gear, goals, settings, saved items and unsent
          changes. You are signed out.
        </li>
      </ul>

      <h2>What cannot be erased</h2>
      <p>
        Activity records written to the public blockchain, and photos on IPFS, are public and
        permanent. No one, including us, can delete them. Anyone who already copied public data
        keeps their copy. Records on the data network can also remain visible for a short while
        until the network catches up.
      </p>

      <h2>No access to the app</h2>
      <p>
        Write to <SupportContact /> from the email you signed up with and ask us to delete your
        data. We can only remove what the server wrote, for the same reasons as above.
      </p>
    </LegalPage>
  );
}
