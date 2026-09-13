import Image from 'next/image';
import styles from './TerritoryBanner.module.css';

export function TerritoryBanner() {
  return (
    <div className={styles.banner}>
      <div className={styles.imageWrap}>
        <Image
          src="/home/phone-territory.png"
          alt="Captured territory on the map"
          width={1982}
          height={848}
          sizes="(max-width: 930px) 100vw, 930px"
          className={styles.image}
        />
      </div>
      <p className={styles.heading}>
        Capture territories in
        <br />
        your community
      </p>
    </div>
  );
}
