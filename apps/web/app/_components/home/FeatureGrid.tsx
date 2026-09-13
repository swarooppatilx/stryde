import Image from 'next/image';
import styles from './FeatureGrid.module.css';

type Card = {
  src: string;
  alt: string;
  background: string;
  contain?: boolean;
  title: React.ReactNode;
  body: string;
};

const cards: Card[] = [
  {
    src: '/home/card-progress.png',
    alt: 'Weekly activity summary',
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
    src: '/home/card-territory.png',
    alt: 'Captured territory on map',
    background: '#E14502',
    contain: true,
    title: 'Take over places.',
    body: 'Capture territories on the map by running around them. Show them off to your friends.',
  },
  {
    src: '/home/card-share.png',
    alt: 'Sharing a run with the community',
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

export function FeatureGrid() {
  return (
    <div className={styles.section}>
      <div className={styles.grid}>
        {cards.map((card) => (
          <div className={styles.card} key={card.src}>
            <div
              className={`${styles.cardImageWrap} ${card.contain ? styles.cardImageWrapPadded : ''}`}
              style={{ background: card.background }}
            >
              <Image
                src={card.src}
                alt={card.alt}
                fill
                sizes="(max-width: 900px) 100vw, 33vw"
                className={card.contain ? styles.cardImageContain : styles.cardImage}
              />
            </div>
            <p className={styles.cardTitle}>{card.title}</p>
            <p className={styles.cardBody}>{card.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
