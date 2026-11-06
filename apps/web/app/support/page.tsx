import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, SupportContact } from '../_components/legal/LegalPage';

export const metadata: Metadata = { title: 'Support | Stryde' };

export default function SupportPage() {
  return (
    <LegalPage title="Support" updated="November 2026">
      <p>
        Contact <SupportContact /> and tell us your phone model, the app version (Settings, Help and
        About) and what happened.
      </p>
      <ul>
        <li>
          Activity not showing: open it from Activities; unsent changes show a waiting mark and send
          when you are online.
        </li>
        <li>
          Recording stops with the screen off: allow location all the time and turn off battery
          limits for Stryde in your phone settings.
        </li>
        <li>
          <Link href="/delete-account">Delete your account</Link> or read the{' '}
          <Link href="/privacy">privacy page</Link>.
        </li>
      </ul>
    </LegalPage>
  );
}
