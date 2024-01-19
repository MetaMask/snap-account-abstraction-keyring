/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Signer } from 'ethers';
import { ethers } from 'hardhat';

import type { KeyringState } from './keyring';
import { AccountAbstractionKeyring } from './keyring';

const defaultState: KeyringState = {
  wallets: {},
  pendingRequests: {},
};

describe('Keyring', () => {
  let aaOwner: Signer;
  let keyring: AccountAbstractionKeyring;

  beforeAll(async () => {
    const signers = await ethers.getSigners();
    aaOwner = signers[0]!;

    keyring = new AccountAbstractionKeyring(defaultState);
  });

  describe('Constructor', () => {
    it('should create a new keyring with default state', () => {
      expect(keyring).toBeDefined();
      expect(keyring.listAccounts()).toBe(defaultState.wallets);
      expect(keyring.listRequests()).toBe(defaultState.pendingRequests);
    });
  });
});
