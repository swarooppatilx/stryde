import type { SavePhase } from '@/services/postRun';

/** The label on the Save button: it says what the save is doing while it runs. */
export function saveButtonLabel(isSaving: boolean, phase: SavePhase | undefined): string {
  if (!isSaving) return 'Save activity';
  return phase === 'uploading-photos' ? 'Uploading photos…' : 'Saving…';
}
