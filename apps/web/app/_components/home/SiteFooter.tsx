import { GithubIcon } from './icons/GithubIcon';
import { StrydeMark } from './icons/StrydeMark';
import styles from './SiteFooter.module.css';

const usefulLinks = ['Register', 'Login', 'Community Map'];
const aboutLinks = ['ETHOnline 2026 Registration', 'Github Repository', 'World ID verification'];

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
          <div className={styles.githubPill}>
            <GithubIcon size={16} />
            <span className={styles.githubPillLabel}>Get it on Github</span>
          </div>
        </div>
        <div className={styles.linkColumn}>
          <p className={styles.linkColumnTitle}>Useful Links</p>
          {usefulLinks.map((link) => (
            <span className={styles.linkItem} key={link}>
              {link}
            </span>
          ))}
        </div>
        <div className={styles.linkColumn}>
          <p className={styles.linkColumnTitle}>About</p>
          {aboutLinks.map((link) => (
            <span className={styles.linkItem} key={link}>
              {link}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.copyright}>© 2026 Stryde. All Rights Reserved.</div>
    </footer>
  );
}
