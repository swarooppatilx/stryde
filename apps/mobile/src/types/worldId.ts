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
