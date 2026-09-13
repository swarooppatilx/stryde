import { Bike, Footprints, Mountain, Ruler } from 'lucide-react';
import styles from './FilterTags.module.css';

const TAGS = [
  { label: 'Run', icon: Footprints },
  { label: 'Ride', icon: Bike },
  { label: 'Walk', icon: Footprints },
  { label: 'Hike', icon: Mountain },
  { label: 'Distance', icon: Ruler },
  { label: 'Elevation', icon: Mountain },
];

export function FilterTags() {
  return (
    <div className={styles.row}>
      {TAGS.map(({ label, icon: Icon }) => (
        <span className={styles.tag} key={label}>
          <Icon size={14} />
          {label}
        </span>
      ))}
    </div>
  );
}
