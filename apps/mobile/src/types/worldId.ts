export type WorldIdEnvironment = 'production' | 'staging' | 'sandbox';

export interface RpSignaturePayload {
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
}

export type WorldVerificationStatus =
  | 'idle'
  | 'opening'
  | 'polling'
  | 'success'
  | 'error'
  | 'cancelled';

export interface WorldVerificationError {
  code: string;
  message: string;
}

/** enroll: Athlete Pass. presence: Finish-Line check for one run. step_up: Proof of Human for a high Sybil band. */
export type WorldCheckKind = 'enroll' | 'presence' | 'step_up';

export type SybilBand = 'low' | 'medium' | 'high';

/** Mirrors the API's public pass: no session id or nullifier ever reaches the app. */
export type PassCredential = 'selfie' | 'proof_of_human';

export interface AthletePass {
  wallet: string;
  /** Absent on passes this device stored before the server reported it. */
  credential?: PassCredential;
  band: SybilBand;
  sybilScore: number | null;
  enrolledAt: number;
  steppedUp: boolean;
  lastPresenceAt: number | null;
  presenceCount: number;
  finishLineMeters: number;
}

export interface PresenceTicket {
  activityHash: string;
  wallet: string;
  verifiedAt: number;
  sybilScore: number | null;
}

/** Why the server is holding a run's reward; each one names the World ID check that releases it. */
export type RewardHold = 'enroll_required' | 'presence_required' | 'step_up_required';

export type RewardGate =
  | { ok: true; reason: string }
  | { ok: false; code: RewardHold; message: string };
