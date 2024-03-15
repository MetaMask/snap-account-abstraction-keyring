import { ethers } from 'ethers';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import type { ChainConfigs } from './ChainConfig';
import { TextField } from './TextField';
import verifyingPaymaster from '../../../snap/artifacts/contracts/samples/VerifyingPaymaster.sol/VerifyingPaymaster.json';
import { getChainConfigs, saveChainConfig } from '../utils';

const PaymasterDeployerContainer = styled.div`
  width: 100%;
  margin: 0 auto 20px auto;
  border: 1px solid #eaeaea;
  border-radius: 4px;
  padding: 8px;
  width: 100%;
`;

const PaymasterDeployerHeader = styled.div`
  margin: 8px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  font-size: 16px;
`;

const PaymasterDeployerContent = styled.div`
  display: ${({ isOpen }: { isOpen: boolean }) => (isOpen ? 'block' : 'none')};
  padding: 0px 8px;
`;

export const PaymasterDeployer = ({ chainId }: { chainId: string }) => {
  const [paymasterAddress, setPaymasterAddress] = useState<string | null>(null);
  const [paymasterSecretKey, setPaymasterSecretKey] = useState<string | null>(
    null,
  );
  const [paymasterDeployed, setPaymasterDeployed] = useState<boolean>(false);
  const [configs, setConfigs] = useState<ChainConfigs>({});
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    getChainConfigs()
      .then((chainConfigs: ChainConfigs) => {
        setConfigs(chainConfigs);
      })
      .catch((error) => {
        setError(error);
      });
  }, []);

  useEffect(() => {
    // clear state
    setPaymasterAddress(null);
    setPaymasterSecretKey(null);
    setPaymasterDeployed(false);

    if (configs[chainId]) {
      setPaymasterAddress(
        configs[chainId]?.customVerifyingPaymasterAddress ?? '',
      );
      setPaymasterSecretKey(configs[chainId]?.customVerifyingPaymasterSK ?? '');
      setPaymasterDeployed(true);
    }
  }, [chainId]);

  const deployPaymaster = async () => {
    if (!paymasterSecretKey) {
      return;
    }

    try {
      await window.ethereum.enable();
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = new ethers.Wallet(paymasterSecretKey, provider);
      const paymasterFactory = new ethers.ContractFactory(
        verifyingPaymaster.abi,
        verifyingPaymaster.bytecode,
        signer,
      );
      const paymaster = await paymasterFactory.deploy(
        configs[chainId]?.entryPoint,
        await signer.getAddress(),
      );
      await paymaster.deployed();

      setPaymasterAddress(paymaster.address);

      await saveChainConfig({
        chainId,
        chainConfig: {
          customVerifyingPaymasterAddress: paymaster.address,
          customVerifyingPaymasterSK: paymasterSecretKey,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-shadow
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <PaymasterDeployerContainer>
      <PaymasterDeployerHeader>
        Deploy Verifying Paymaster
      </PaymasterDeployerHeader>
      <PaymasterDeployerContent isOpen>
        <TextField
          id={'verify-paymaster-admin-secret-key'}
          placeholder={'Verifying Paymaster Secret Key'}
          value={paymasterSecretKey as string}
          onChange={(event) => setPaymasterSecretKey(event.target.value)}
        />
        <button type="button" onClick={async () => deployPaymaster()}>
          {paymasterDeployed ? 'Redeploy Paymaster' : 'Deploy Paymaster'}
        </button>
      </PaymasterDeployerContent>
    </PaymasterDeployerContainer>
  );
};
