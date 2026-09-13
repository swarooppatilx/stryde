import Link from 'next/link';
import { GithubIcon } from './icons/GithubIcon';
import { StrydeMark } from './icons/StrydeMark';
import styles from './SiteFooter.module.css';

const GITHUB_URL = 'https://github.com/swarooppatilx/stryde';

const usefulLinks = [
  { label: 'Activities', href: '/activities' },
  { label: 'Challenges', href: '/challenges' },
  { label: 'Maps', href: '/maps' },
];

const aboutLinks = [
  { label: 'ETHOnline 2026 Registration', href: 'https://ethglobal.com/showcase/stryde-yh9p9' },
  { label: 'Github Repository', href: GITHUB_URL },
  { label: 'World ID verification', href: 'https://world.org/' },
];

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div className={styles.brandColumn}>
          <div className={styles.brandRow}>
            <StrydeMark width={14} height={23} />
            <span className={styles.brandName}>STRYDE</span>
          </div>
          <p className={styles.tagline}>
            Run with the community.
            <br />
            On web3.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubPill}
          >
            <GithubIcon size={16} />
            <span className={styles.githubPillLabel}>Get it on Github</span>
          </a>
        </div>
        <div className={styles.linkColumn}>
          <p className={styles.linkColumnTitle}>Useful Links</p>
          {usefulLinks.map((link) => (
            <Link href={link.href} className={styles.linkItem} key={link.label}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className={styles.linkColumn}>
          <p className={styles.linkColumnTitle}>About</p>
          {aboutLinks.map((link) => (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkItem}
              key={link.label}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className={styles.copyright}>© 2026 Stryde. All Rights Reserved.</div>
    </footer>
  );
}
