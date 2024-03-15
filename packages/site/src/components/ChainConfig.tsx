import type {
  KeyringRequest,
  KeyringSnapRpcClient,
} from '@metamask/keyring-api';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import * as uuid from 'uuid';

import { StyledBox } from './styledComponents';
import { defaultSnapOrigin } from '../config';
import { chainIdToName } from '../utils/chains';

const ChainConfigErrorContainer = styled.div`
  color: #721c24;
`;

const ChainConfigSuccessContainer = styled.div`
  color: #155724;
`;

const ChainConfigContainer = styled.div`
  width: 100%;
  margin: 0 auto;
`;

const ChainConfigItem = styled.div`
  border: 1px solid #eaeaea;
  border-radius: 4px;
  margin-bottom: 20px;
  padding: 8px;
  width: 100%;
`;

const ChainConfigHeader = styled.div`
  margin: 8px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  font-size: 16px;
`;

const ChainConfigContent = styled.div`
  display: ${({ isOpen }: { isOpen: boolean }) => (isOpen ? 'block' : 'none')};
  padding: 0px 8px;
`;

const ChainDescription = styled.p`
  font-size: 14px;
  font-weight: bold;
  margin: 5px 2.5% 5px 16px;
`;

const TextField = styled.input`
  width: calc(95% - 16px);
  padding: 10px;
  margin: 8px 2.5% 8px 16px;
  background: transparent;
  border-radius: 5px;
  box-sizing: border-box;
  border: 1px solid #bbc0c5;
`;

const Select = styled.select`
  width: calc(95% - 16px);
  padding-top: 8px;
  padding-bottom: 10px;
  margin: 8px 2.5% 8px 0px;
  border-radius: 5px;
`;

const SelectItem = styled.option`
  margin-left: 16px;
  padding-left: 4px;

  :disabled {
    font-style: italic;
  }
`;

export type ChainConfig = {
  simpleAccountFactory?: string;
  entryPoint?: string;
  bundlerUrl?: string;
  customVerifyingPaymasterPK?: string;
  customVerifyingPaymasterAddress?: string;
};

export type ChainConfigs = {
  [chainId: string]: ChainConfig;
};

export const ChainConfig = ({ client }: { client: KeyringSnapRpcClient }) => {
  const [chainConfigs, setChainConfigs] = useState<ChainConfigs>({});
  const [chainSelected, setChainSelected] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>();
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    const getChainConfigs = async () => {
      try {
        const configs = await window.ethereum.request({
          method: 'wallet_invokeSnap',
          params: {
            snapId: defaultSnapOrigin,
            request: { method: 'snap.internal.getConfigs' },
          },
        });

        setChainConfigs(configs as ChainConfigs);
        // eslint-disable-next-line @typescript-eslint/no-shadow
      } catch (error) {
        setError(error as Error);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-shadow
    getChainConfigs().catch((error) => setError(error));
  }, []);

  useEffect(() => {
    // set default values for unknown chain
    if (!chainSelected && !chainConfigs[chainSelected as string]) {
      setChainConfigs({
        ...chainConfigs,
        [chainSelected as string]: {
          simpleAccountFactory: '',
          entryPoint: '',
          bundlerUrl: '',
          customVerifyingPaymasterPK: '',
          customVerifyingPaymasterAddress: '',
        },
      });
    }
  }, [chainSelected]);

  const updateSpecificChainConfig = (
    chainId: string,
    configKey: keyof ChainConfig,
    value: string,
  ) => {
    setChainConfigs({
      ...chainConfigs,
      [chainId]: {
        ...chainConfigs[chainId],
        [configKey]: value,
      },
    });
  };

  const updateChainConfig = async () => {
    setError(undefined);
    setSuccessMessage(undefined);
    if (!chainSelected || !chainConfigs[chainSelected]) {
      return;
    }
    try {
      const request: KeyringRequest = {
        id: uuid.v4(),
        scope: '',
        account: uuid.v4(),
        request: {
          method: 'snap.internal.setConfig',
          params: [chainConfigs[chainSelected] as ChainConfig],
        },
      };
      await client.submitRequest(request);
      setSuccessMessage('Chain Config Updated');
      // eslint-disable-next-line @typescript-eslint/no-shadow
    } catch (error) {
      setError(error as Error);
    }
  };

  return (
    <ChainConfigContainer>
      <ChainConfigItem>
        <ChainConfigHeader>{'Chain Configuration'}</ChainConfigHeader>
        <ChainConfigContent isOpen>
          <ChainConfigErrorContainer>
            {error && <p>{error.message}</p>}
          </ChainConfigErrorContainer>
          <ChainConfigSuccessContainer>
            {successMessage && <p>{successMessage}</p>}
          </ChainConfigSuccessContainer>
          <Select
            value={chainSelected ?? ''}
            onChange={(event) => {
              setChainSelected(event.target.value);
            }}
          >
            <SelectItem disabled value="">
              {'Select Chain'}
            </SelectItem>
            {Object.keys(chainConfigs).map((option: string) => (
              <SelectItem value={option} key={option}>
                {chainIdToName(option) ?? `Chain ${option}`}
              </SelectItem>
            ))}
          </Select>
          {chainSelected && (
            <StyledBox sx={{ flexGrow: 1 }}>
              <ChainDescription>Simple Account Factory</ChainDescription>
              <TextField
                id={'simpleAccountFactory'}
                placeholder={
                  chainConfigs?.[chainSelected]?.simpleAccountFactory ??
                  'Simple Account Factory Address'
                }
                value={
                  chainConfigs?.[chainSelected]?.simpleAccountFactory ?? ''
                }
                onChange={(event) =>
                  updateSpecificChainConfig(
                    chainSelected,
                    'simpleAccountFactory',
                    event.target.value,
                  )
                }
              />
              <ChainDescription>Entrypoint Contract</ChainDescription>
              <TextField
                id={'entrypoint'}
                placeholder={
                  chainConfigs?.[chainSelected]?.entryPoint ??
                  'Entrypoint Address'
                }
                value={chainConfigs?.[chainSelected]?.entryPoint ?? ''}
                onChange={(event) =>
                  updateSpecificChainConfig(
                    chainSelected,
                    'entryPoint',
                    event.target.value,
                  )
                }
              />
              <ChainDescription>Bundler Url</ChainDescription>
              <TextField
                id={'bundlerUrl'}
                style={{
                  borderColor: chainConfigs?.[chainSelected]?.bundlerUrl
                    ? ''
                    : 'red',
                }}
                placeholder={
                  chainConfigs?.[chainSelected]?.bundlerUrl ?? 'Bundler URL'
                }
                value={chainConfigs?.[chainSelected]?.bundlerUrl ?? ''}
                onChange={(event) =>
                  updateSpecificChainConfig(
                    chainSelected,
                    'bundlerUrl',
                    event.target.value,
                  )
                }
              />
              <ChainDescription>Verifying Paymaster Address</ChainDescription>
              <TextField
                id={'customVerifyingPaymasterAddress'}
                placeholder={
                  chainConfigs?.[chainSelected]
                    ?.customVerifyingPaymasterAddress ??
                  'Custom Verifying Paymaster Address'
                }
                value={
                  chainConfigs?.[chainSelected]
                    ?.customVerifyingPaymasterAddress ?? ''
                }
                onChange={(event) =>
                  updateSpecificChainConfig(
                    chainSelected,
                    'customVerifyingPaymasterAddress',
                    event.target.value,
                  )
                }
              />
              <ChainDescription>
                Verifying Paymaster Private Key
              </ChainDescription>
              <TextField
                id={'customVerifyingPaymasterPK'}
                placeholder={
                  chainConfigs?.[chainSelected]?.customVerifyingPaymasterPK ??
                  'Custom Verifying Paymaster PK'
                }
                value={
                  chainConfigs?.[chainSelected]?.customVerifyingPaymasterPK ??
                  ''
                }
                onChange={(event) =>
                  updateSpecificChainConfig(
                    chainSelected,
                    'customVerifyingPaymasterPK',
                    event.target.value,
                  )
                }
              />
            </StyledBox>
          )}

          <button type="button" onClick={async () => updateChainConfig()}>
            Set Chain Config
          </button>
        </ChainConfigContent>
      </ChainConfigItem>
    </ChainConfigContainer>
  );
};
