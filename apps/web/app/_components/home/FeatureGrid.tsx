import Image from 'next/image';
import styles from './FeatureGrid.module.css';

type PhoneCard = {
  screenshot: string;
  alt: string;
  background: string;
  contain?: boolean;
  title: React.ReactNode;
  body: string;
};

const cards: PhoneCard[] = [
  {
    screenshot: '/home/screenshot-progress.jpeg',
    alt: 'Profile showing weekly distance, time, and territory stats',
    background: '#000000',
    title: (
      <>
        View your progress
        <br />
        in one place.
      </>
    ),
    body: 'A comprehensive activity tracking system that shows you everything about your runs so you can keep going.',
  },
  {
    screenshot: '/home/territory-share.jpeg',
    alt: 'Captured territory shared from a run',
    background: '#E14502',
    title: 'Take over places.',
    body: 'Capture territories on the map by running around them. Show them off to your friends.',
  },
  {
    screenshot: '/home/screenshot-feed.jpeg',
    alt: 'Activity feed showing a shared run',
    background: '#000000',
    title: (
      <>
        Share it with your
        <br />
        community.
      </>
    ),
    body: 'Share your exciting moments with everyone around you.',
  },
];

const phoneCards: PhoneCard[] = [
  {
    screenshot: '/home/screenshot-groups.jpeg',
    alt: 'Browsing community events and challenges',
    background: '#000000',
    title: 'Join the community.',
    body: 'Compete in challenges and events with runners around you.',
  },
  {
    screenshot: '/home/screenshot-profile.jpeg',
    alt: 'Profile with stats, streak, and wallet',
    background: '#E14502',
    title: 'Own your progress.',
    body: 'Your stats, your wallet, your streak — all in one profile.',
  },
  {
    screenshot: '/home/screenshot-worldid.jpeg',
    alt: 'World ID successfully connected',
    background: '#000000',
    title: (
      <>
        Verify once,
        <br />
        run forever.
      </>
    ),
    body: "Connect World ID to prove you're human and unlock the full experience.",
  },
];

function PhoneCardItem({ card }: { card: PhoneCard }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardImageWrap} style={{ background: card.background }}>
        <div className={styles.cardPhoneFrame}>
          <Image
            src="/home/phone-frame.png"
            alt=""
            fill
            sizes="180px"
            className={styles.cardPhoneFrameImage}
          />
          <div className={styles.cardPhoneScreenWrap}>
            <Image
              src={card.screenshot}
              alt={card.alt}
              fill
              sizes="160px"
              className={card.contain ? styles.cardPhoneScreenContain : styles.cardPhoneScreen}
            />
          </div>
        </div>
      </div>
      <p className={styles.cardTitle}>{card.title}</p>
      <p className={styles.cardBody}>{card.body}</p>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <div className={styles.section}>
      <div className={styles.grid}>
        {cards.map((card) => (
          <PhoneCardItem card={card} key={card.screenshot} />
        ))}
      </div>
      <div className={styles.grid}>
        {phoneCards.map((card) => (
          <PhoneCardItem card={card} key={card.screenshot} />
        ))}
      </div>
    </div>
  );
}
