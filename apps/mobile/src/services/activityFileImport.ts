import { isDuplicateActivity, type OwnActivity } from '@/utils/importDuplicates';
import { trackFromGpx } from '@/utils/importGpx';
import { tracksFromTcx } from '@/utils/importTcx';
import type { ImportedTrack } from '@/utils/importTrack';
import type { PostRunInput } from './postRun';
import { activityFromTrack } from './trackImport';

export interface FileImportItem {
  /** The same for the same track, to notice it twice. */
  key: string;
  input: PostRunInput;
}

export type FileParse = { ok: true; items: FileImportItem[] } | { ok: false; message: string };

/** The file kinds that can be imported, by extension. */
export function fileKind(name: string): 'gpx' | 'tcx' | null {
  const extension = name.toLowerCase().split('.').at(-1);
  return extension === 'gpx' || extension === 'tcx' ? extension : null;
}

/** Reads the activities in one GPX or TCX file, or says in a plain sentence why it cannot. */
export function parseActivityFile(
  name: string,
  text: string,
  options: { splitMeters: number }
): FileParse {
  const kind = fileKind(name);
  if (!kind) return { ok: false, message: `${name} is not a GPX or TCX file.` };

  const tracks: ImportedTrack[] | null =
    kind === 'gpx' ? ((t) => (t ? [t] : null))(trackFromGpx(text)) : tracksFromTcx(text);
  if (!tracks)
    return { ok: false, message: `${name} is not a readable ${kind.toUpperCase()} file.` };

  const items: FileImportItem[] = [];
  let reason: 'no-times' | 'too-short' = 'too-short';
  for (const track of tracks) {
    const result = activityFromTrack(track, {
      description: `Imported from a ${kind.toUpperCase()} file`,
      splitMeters: options.splitMeters,
    });
    if (result.ok) items.push({ key: result.key, input: result.input });
    else reason = result.reason;
  }
  if (items.length === 0) {
    return {
      ok: false,
      message:
        reason === 'no-times'
          ? `${name} has no times on its points.`
          : `${name} is too short to be an activity.`,
    };
  }
  return { ok: true, items };
}

export interface PreviewItem extends FileImportItem {
  id: string;
  fileName: string;
  /** Looks like an activity already here (or earlier in this batch); starts unticked. */
  duplicate: boolean;
  selected: boolean;
}

/** The review list: every activity found, ticked unless it looks like one already saved. */
export function buildPreview(
  files: ReadonlyArray<{ fileName: string; items: readonly FileImportItem[] }>,
  own: readonly OwnActivity[]
): PreviewItem[] {
  const seen = new Set<string>();
  const preview: PreviewItem[] = [];
  for (const { fileName, items } of files) {
    for (const item of items) {
      const duplicate =
        seen.has(item.key) ||
        isDuplicateActivity(
          { startedAt: item.input.startedAt ?? 0, distance: item.input.distance },
          own
        );
      seen.add(item.key);
      preview.push({
        ...item,
        id: `${preview.length}:${item.key}`,
        fileName,
        duplicate,
        selected: !duplicate,
      });
    }
  }
  return preview;
}
