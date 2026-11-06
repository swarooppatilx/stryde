import { describe, expect, it } from 'vitest';
import { RejectedError } from '@/backends/outbox/outbox';
import { apiRefusal, refuseApiError, refuseContractRevert } from '@/services/refusals';

const http = (status: number, message = `HTTP ${status}`) =>
  Object.assign(new Error(message), { status });

describe('apiRefusal', () => {
  it('keeps the server message so the athlete sees why it was refused', () => {
    const rejected = apiRefusal(http(403, 'You are blocked'));
    expect(rejected).toBeInstanceOf(RejectedError);
    expect(rejected.message).toBe('You are blocked');
  });

  it('says "Refused" when the failure carries no message', () => {
    expect(apiRefusal({ status: 400 }).message).toBe('Refused');
  });
});

describe('refuseApiError', () => {
  it('turns a 4xx into a final rejection, which the outbox never retries', () => {
    expect(() => refuseApiError(http(400, 'Bad request'))).toThrow(RejectedError);
  });

  it('rethrows an outage or a retryable client error untouched so the outbox tries again', () => {
    for (const status of [500, 503, 408, 425, 429]) {
      const error = http(status);
      expect(() => refuseApiError(error)).toThrow(error);
      expect(() => refuseApiError(error)).not.toThrow(RejectedError);
    }
    const network = new Error('Network request failed');
    expect(() => refuseApiError(network)).toThrow(network);
  });
});

describe('refuseContractRevert', () => {
  const revert = (name: string) =>
    Object.assign(new Error('reverted'), {
      name: 'ContractFunctionRevertedError',
      data: { errorName: name },
    });

  it('turns a contract revert into a final rejection that names what was refused', () => {
    expect(() => refuseContractRevert(revert('NotMember'), 'leave')).toThrow(RejectedError);
    expect(() => refuseContractRevert(revert('NotMember'), 'leave')).toThrow(
      'The contract refused the leave (NotMember)'
    );
  });

  it('leaves the name out of the message for a revert with no named error', () => {
    expect(() => refuseContractRevert(revert(''), 'join')).toThrow('The contract refused the join');
  });

  it('rethrows anything that is not a revert so it can be retried', () => {
    const timeout = new Error('timeout');
    expect(() => refuseContractRevert(timeout, 'leave')).toThrow(timeout);
  });
});
