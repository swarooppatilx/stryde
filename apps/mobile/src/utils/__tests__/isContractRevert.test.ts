import { describe, expect, it } from 'vitest';
import { isContractRevert, revertName } from '@/utils/isContractRevert';

const named = (name: string, cause?: unknown) => Object.assign(new Error(name), { name, cause });

describe('isContractRevert', () => {
  it('recognises a revert, however deep viem wrapped it', () => {
    const revert = named('ContractFunctionRevertedError');
    expect(isContractRevert(revert)).toBe(true);
    expect(isContractRevert(named('ContractFunctionExecutionError', revert))).toBe(true);
  });

  it('treats anything else as a failure worth retrying', () => {
    expect(isContractRevert(new Error('rpc down'))).toBe(false);
    expect(isContractRevert(named('HttpRequestError'))).toBe(false);
    expect(isContractRevert('nope')).toBe(false);
    expect(isContractRevert(undefined)).toBe(false);
  });

  it('gives up on a cause chain that loops', () => {
    const a = named('A');
    a.cause = a;
    expect(isContractRevert(a)).toBe(false);
  });
});

describe('revertName', () => {
  it('gives the contract error the call reverted with', () => {
    const revert = Object.assign(new Error('x'), {
      name: 'ContractFunctionRevertedError',
      data: { errorName: 'DuplicateComment' },
    });
    expect(revertName(named('ContractFunctionExecutionError', revert))).toBe('DuplicateComment');
  });

  it('is an empty string for a revert without a named error, and null when it was not a revert', () => {
    expect(revertName(named('ContractFunctionRevertedError'))).toBe('');
    expect(revertName(new Error('rpc down'))).toBeNull();
  });
});
