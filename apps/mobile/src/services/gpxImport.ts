import { trackFromGpx } from '@/utils/importGpx';
import { activityFromTrack, type TrackImport } from './trackImport';

const SPLIT_M = 1000;

export type GpxImport = TrackImport | { ok: false; reason: 'unreadable' };

/** The activity a GPX file becomes; see `activityFromTrack` for what a file needs to carry. */
export function activityInputFromGpx(xml: string): GpxImport {
  const track = trackFromGpx(xml);
  if (!track) return { ok: false, reason: 'unreadable' };
  return activityFromTrack(track, {
    description: 'Imported from a GPX file',
    splitMeters: SPLIT_M,
  });
}
