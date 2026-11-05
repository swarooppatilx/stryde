import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  InsufficientFundsError,
} from 'viem';

const abi = [
  { type: 'error', name: 'SeasonAlreadyActive', inputs: [] },
  { type: 'error', name: 'NotRecorder', inputs: [] },
  { type: 'error', name: 'AlreadyMinted', inputs: [] },
  { type: 'error', name: 'NotSettler', inputs: [] },
  { type: 'error', name: 'SettleWindowClosed', inputs: [] },
  { type: 'error', name: 'SeasonNotActive', inputs: [] },
  { type: 'error', name: 'NotRegistered', inputs: [] },
  { type: 'error', name: 'NullifierAlreadyUsed', inputs: [] },
  { type: 'error', name: 'Unmapped', inputs: [] },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address' }],
  },
] as const;

export type RevertName = (typeof abi)[number]['name'];

/** What viem throws when a contract call reverts with the named custom error. */
export function revertedWith(errorName: RevertName): Error {
  const data =
    errorName === 'OwnableUnauthorizedAccount'
      ? encodeErrorResult({ abi, errorName, args: ['0x00000000000000000000000000000000000000aa'] })
      : encodeErrorResult({ abi, errorName } as never);
  const cause = new ContractFunctionRevertedError({ abi, data, functionName: 'f' });
  return new ContractFunctionExecutionError(cause, { abi, functionName: 'f', args: [] });
}

/** What viem throws when the sending account cannot pay for gas. */
export function outOfGas(): Error {
  return new ContractFunctionExecutionError(
    new InsufficientFundsError({ cause: new BaseError('rpc') }),
    { abi, functionName: 'f', args: [] }
  );
}
