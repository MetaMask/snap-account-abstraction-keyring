import { ethers } from 'ethers';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import type { ChainConfigs } from './ChainConfig';
import verifyingPaymaster from '../../../snap/artifacts/contracts/samples/VerifyingPaymaster.sol/VerifyingPaymaster.json';
import { getChainConfigs, saveChainConfig } from '../utils';
import { TextField } from './TextField';

const PaymasterDeployerContainer = styled.div`
  width: 100%;
  margin: 0 auto;
  border: 1px solid #eaeaea;
  border-radius: 4px;
  margin-bottom: 20px;
  width: 100%;
`;

const PaymasterDeployerContent = styled.div`
  display: ${({ isOpen }: { isOpen: boolean }) => (isOpen ? 'block' : 'none')};
  padding: 0px 8px;
`;

const PaymasterDeployerDescription = styled.p`
  font-size: 14px;
  font-weight: bold;
  margin: 5px 2.5% 5px 16px;
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
      setPaymasterSecretKey(configs[chainId]?.customVerifyingPaymasterPK ?? '');
      setPaymasterDeployed(true);
    }
  }, [chainId]);

  const deployPaymaster = async () => {
    console.log('deploying paymaster');
    console.log('paymasterSecretKey', paymasterSecretKey);
    if (!paymasterSecretKey) {
      return;
    }

    try {
      await window.ethereum.enable();
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      console.log('signer', await signer.getAddress());
      const paymasterFactory = new ethers.ContractFactory(
        verifyingPaymaster.abi,
        verifyingPaymaster.bytecode,
        signer,
      );
      console.log('paymaster factory', paymasterFactory);
      console.log('chainid', chainId);
      console.log('configs[chainId]', configs[chainId]);
      console.log('entry point', configs[chainId]?.entryPoint);
      const paymaster = await paymasterFactory.deploy(
        configs[chainId]?.entryPoint,
        await signer.getAddress(),
      );
      await paymaster.deployed();

      setPaymasterAddress(paymaster.address);

      await saveChainConfig({
        chainId,
        verifyingPaymasterAddress: paymaster.address,
        verifyingPaymasterPK: paymasterSecretKey,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <PaymasterDeployerContainer>
      <PaymasterDeployerContent isOpen>
        <PaymasterDeployerDescription>
          Deploy Verifying Paymaster
        </PaymasterDeployerDescription>
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
