/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Signer } from 'ethers';
import { ethers } from 'hardhat';

import type { KeyringState } from './keyring';
import { AAKeyring } from './keyring';

const defaultState: KeyringState = {
  wallets: {},
  pendingRequests: {},
  useSyncApprovals: false,
};

describe('Keyring', () => {
  let aaOwner: Signer;
  let keyring: AAKeyring;

  beforeAll(async () => {
    const signers = await ethers.getSigners();
    aaOwner = signers[0]!;

    keyring = new AAKeyring(defaultState);
  });

  it('keyring should be defined', () => {
    expect(keyring).toBeDefined();
  });
});
