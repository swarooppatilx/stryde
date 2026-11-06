import Link from 'next/link';
import type { ReactNode } from 'react';
import { supportEmail } from '../../_lib/support';
import styles from './LegalPage.module.css';

export function SupportContact() {
  const email = supportEmail();
  if (!email) return <>the support address, which has not been published yet</>;
  return <a href={`mailto:${email}`}>{email}</a>;
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        Stryde
      </Link>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.updated}>Last updated {updated}</p>
      <div className={styles.body}>{children}</div>
      <nav className={styles.links} aria-label="Legal">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/delete-account">Delete your account</Link>
        <Link href="/support">Support</Link>
      </nav>
    </main>
  );
}
