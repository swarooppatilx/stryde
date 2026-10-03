import { useState } from 'react';
import { PhotoCarousel } from './photo-carousel';
import { PhotoViewer } from './photo-viewer';

interface PhotoGalleryProps {
  photos: string[];
}

/** A post's or activity's photos in a swipeable frame; a tap opens them full screen. */
export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [opened, setOpened] = useState<number | null>(null);
  return (
    <>
      <PhotoCarousel photos={photos} onOpen={setOpened} />
      <PhotoViewer photos={photos} startIndex={opened} onClose={() => setOpened(null)} />
    </>
  );
}
