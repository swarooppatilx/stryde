import { useEffect, useRef, useState } from 'react';
import type { Lap } from '@/types';

/** How long the "Lap complete" card stays up. */
export const LAP_CARD_MS = 4000;

/** The lap to announce right after Lap is pressed, then null once the card has had its time. */
export function useLapCard(lapCount: number, lastLap: Lap | null): Lap | null {
  const [card, setCard] = useState<Lap | null>(null);
  const seen = useRef(lapCount);

  useEffect(() => {
    if (lapCount < seen.current) setCard(null);
    const pressed = lapCount > seen.current && lastLap !== null;
    seen.current = lapCount;
    if (!pressed) return;
    setCard(lastLap);
    const timer = setTimeout(() => setCard(null), LAP_CARD_MS);
    return () => clearTimeout(timer);
  }, [lapCount, lastLap]);

  return card;
}
