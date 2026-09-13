import Image from 'next/image';
import styles from './Hero.module.css';
import { GithubIcon } from './icons/GithubIcon';

export function Hero() {
  return (
    <div className={styles.hero}>
      <div className={styles.heroImagePanel}>
        <Image
          src="/home/hero-run.jpg"
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 60vw"
          className={styles.heroImage}
          preload
        />
        <div className={styles.heroOverlay} />
        <p className={styles.heroHeadline}>
          Run with
          <br />
          the community
          <span className={styles.heroHeadlineAccent}>.</span>
        </p>
      </div>
      <div className={styles.phonePanel}>
        <div className={styles.phoneFrameWrap}>
          <Image
            src="/home/phone-frame.png"
            alt=""
            fill
            sizes="260px"
            className={styles.phoneFrame}
          />
          <div className={styles.phoneScreenWrap}>
            <Image
              src="/home/phone-screen.png"
              alt="Live run tracking"
              fill
              sizes="220px"
              className={styles.phoneScreen}
            />
          </div>
        </div>
        <div className={styles.githubPill}>
          <GithubIcon />
          <span className={styles.githubPillLabel}>Get it on Github</span>
        </div>
      </div>
    </div>
  );
}
