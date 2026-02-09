import { ethers } from 'ethers';
import React, { useContext, useEffect, useState } from 'react';
import styled from 'styled-components';

import type { ChainConfigs } from './ChainConfig';
import { ErrorContainer } from './ErrorContainer';
import { SuccessContainer } from './SuccessContainer';
import { TextField } from './TextField';
import verifyingPaymaster from '../../../snap/artifacts/contracts/samples/VerifyingPaymaster.sol/VerifyingPaymaster.json';
import { MetaMaskContext } from '../hooks';
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

export const PaymasterDeployer = () => {
  const [state] = useContext(MetaMaskContext);
  const [paymasterAddress, setPaymasterAddress] = useState<string | null>(null);
  const [paymasterSecretKey, setPaymasterSecretKey] = useState<string | null>(
    null,
  );
  const [configs, setConfigs] = useState<ChainConfigs>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | null>();

  useEffect(() => {
    if (!state.installedSnap) {
      return;
    }
    getChainConfigs()
      .then((chainConfigs: ChainConfigs) => {
        setConfigs(chainConfigs);
      })
      // eslint-disable-next-line @typescript-eslint/no-shadow
      .catch((error) => {
        setError(error);
      });
  }, [state]);

  const deployPaymaster = async () => {
    // clear state
    setPaymasterAddress(null);
    setPaymasterSecretKey(null);
    setError(undefined);
    setLoading(true);

    if (!paymasterSecretKey) {
      setError(new Error('Please provide a secret key'));
      return;
    }

    let hexSecretKey;
    // eslint-disable-next-line no-negated-condition
    if (!paymasterSecretKey.startsWith('0x')) {
      hexSecretKey = `0x${paymasterSecretKey}`;
    } else {
      hexSecretKey = paymasterSecretKey;
    }

    try {
      // eslint-disable-next-line no-new
      new ethers.Wallet(hexSecretKey);
    } catch {
      setError(new Error('Invalid secret key'));
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - MetaMask provider would work for Web3Provider
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const { chainId } = await provider.getNetwork();
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
        chainId: chainId.toString(),
        chainConfig: {
          customVerifyingPaymasterAddress: paymaster.address,
          customVerifyingPaymasterSK: hexSecretKey,
        },
      });
      setSuccessMessage(
        `Verifying Paymaster Deployed to ${paymasterAddress as string}`,
      );
      // eslint-disable-next-line @typescript-eslint/no-shadow
    } catch (error) {
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PaymasterDeployerContainer>
      <PaymasterDeployerHeader>
        Deploy Verifying Paymaster
      </PaymasterDeployerHeader>
      {error && <ErrorContainer error={error.message} />}
      {successMessage && <SuccessContainer message={successMessage} />}
      <PaymasterDeployerContent isOpen>
        <TextField
          id={'verify-paymaster-admin-secret-key'}
          placeholder={'Verifying Paymaster Secret Key in Hex Format'}
          value={paymasterSecretKey as string}
          onChange={(event) => setPaymasterSecretKey(event.target.value)}
        />
        <button
          type="button"
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={async () => {
            await deployPaymaster();
          }}
          disabled={!paymasterSecretKey || loading}
        >
          {loading ? 'Deploying' : 'Deploy Paymaster'}
        </button>
      </PaymasterDeployerContent>
    </PaymasterDeployerContainer>
  );
};
