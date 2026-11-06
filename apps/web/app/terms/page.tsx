import type { Metadata } from 'next';
import { LegalPage, SupportContact } from '../_components/legal/LegalPage';

export const metadata: Metadata = { title: 'Terms | Stryde' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="November 2026">
      <p>By using Stryde you agree to these terms. If you do not agree, do not use the app.</p>

      <h2>Your account</h2>
      <p>
        You sign in with your email. You are responsible for activity on your account and for the
        details you enter. You must be at least 13 years old.
      </p>

      <h2>Exercise safely</h2>
      <p>
        Stryde records and shows activity; it gives no medical advice. Exercise at your own risk,
        follow local rules and pay attention to your surroundings.
      </p>

      <h2>What you share</h2>
      <p>
        You keep ownership of what you post. By publishing an activity, photo or post you accept
        that it is written to public networks that anyone can read and that we cannot remove from
        them. Do not post anything you are not allowed to share or that you would not want to be
        public for good.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>No harassment, spam or impersonation.</li>
        <li>
          No fake activities, simulated locations or other attempts to cheat records or rewards.
        </li>
        <li>No attempts to break, overload or reverse the service.</li>
      </ul>
      <p>
        We may hide content or limit an account that breaks these rules. You can report content in
        the app.
      </p>

      <h2>Tokens and rewards</h2>
      <p>
        Any tokens or rewards in the app run on a test network where they have no cash value, and
        they may change or be reset.
      </p>

      <h2>The service</h2>
      <p>
        The app is provided as is, without promises that it will always be available or free of
        errors. To the extent the law allows, we are not liable for indirect losses, or for data
        lost because of your phone or connection.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can delete your account at any time as explained on the delete account page. These terms
        may be updated; continued use after a change means you accept it.
      </p>

      <h2>Contact</h2>
      <p>
        <SupportContact />
      </p>
    </LegalPage>
  );
}
