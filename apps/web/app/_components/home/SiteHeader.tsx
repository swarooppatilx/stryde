'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StrydeMark } from './icons/StrydeMark';
import styles from './SiteHeader.module.css';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/activities', label: 'Activities' },
  { href: '/challenges', label: 'Challenges' },
  { href: '/maps', label: 'Maps' },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <StrydeMark />
        <Image src="/home/stryde-wordmark.svg" alt="Stryde" width={72} height={16} unoptimized />
      </div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? styles.navItemActive : styles.navLink}
            >
              <span className={isActive ? styles.navItemActiveLabel : undefined}>{item.label}</span>
              {isActive && <div className={styles.navItemActiveBar} />}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
