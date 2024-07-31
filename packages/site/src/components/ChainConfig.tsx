/* eslint-disable @typescript-eslint/no-misused-promises */
import React, { useContext, useEffect, useState } from 'react';
import styled from 'styled-components';

import { ErrorContainer } from './ErrorContainer';
import { StyledBox } from './styledComponents';
import { SuccessContainer } from './SuccessContainer';
import { TextField } from './TextField';
import { MetaMaskContext } from '../hooks';
import { getChainConfigs, saveChainConfig } from '../utils';
import { chainIdToName } from '../utils/chains';

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
  customVerifyingPaymasterSK?: string;
  customVerifyingPaymasterAddress?: string;
};

export const ConfigKeys = {
  simpleAccountFactory: 'Simple Account Factory',
  entryPoint: 'Entrypoint Address',
  bundlerUrl: 'Bundle Url',
  customVerifyingPaymasterSK: 'Verifying Paymaster Secret Key',
  customVerifyingPaymasterAddress: 'Verifying Paymaster Contract Address',
};

export type ChainConfigs = {
  [chainId: string]: ChainConfig;
};

export const ChainConfigComponent = () => {
  const [state] = useContext(MetaMaskContext);
  const [chainConfigs, setChainConfigs] = useState<ChainConfigs>({});
  const [chainSelected, setChainSelected] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>();
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!state.installedSnap) {
      return;
    }
    getChainConfigs()
      .then((configs) => setChainConfigs(configs))
      // eslint-disable-next-line @typescript-eslint/no-shadow
      .catch((error) => setError(error));
  }, [state]);

  useEffect(() => {
    // set default values for unknown chain
    if (!chainSelected && !chainConfigs[chainSelected]) {
      setChainConfigs({
        ...chainConfigs,
        [chainSelected]: {
          simpleAccountFactory: '',
          entryPoint: '',
          bundlerUrl: '',
          customVerifyingPaymasterSK: '',
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
    console.log(chainConfigs);
  };

  const updateChainConfig = async () => {
    setError(undefined);
    setSuccessMessage(undefined);
    if (!chainSelected || !chainConfigs[chainSelected]) {
      return;
    }
    try {
      await saveChainConfig({
        chainId: chainSelected,
        chainConfig: chainConfigs[chainSelected] as ChainConfig,
      });
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
          {error && <ErrorContainer error={error.message} />}
          {successMessage && <SuccessContainer message={successMessage} />}
          <Select
            data-testid="chain-select"
            value={chainSelected ?? ''}
            onChange={(event) => {
              setChainSelected(event.target.value);
            }}
          >
            <SelectItem disabled value="">
              {'Select Chain'}
            </SelectItem>
            {Object.keys(chainConfigs).map((option: string) => (
              <SelectItem
                value={option}
                key={option}
                data-testid={`chain-id-${option}`}
              >
                {chainIdToName(option) ?? `Chain ${option}`}
              </SelectItem>
            ))}
          </Select>
          {chainSelected && chainConfigs[chainSelected] && (
            <StyledBox sx={{ flexGrow: 1 }}>
              {Object.entries(ConfigKeys).map(
                ([key, title]: [key: string, title: string]) => {
                  return (
                    <>
                      <ChainDescription key={key}>{title}</ChainDescription>
                      <TextField
                        id={key}
                        data-testid={key}
                        placeholder={
                          chainConfigs?.[chainSelected]?.[
                            key as keyof ChainConfig
                          ] ?? key
                        }
                        value={
                          chainConfigs[chainSelected]?.[
                            key as keyof ChainConfig
                          ] ?? ''
                        }
                        style={{
                          borderColor:
                            [
                              'customVerifyingPaymasterSK',
                              'customVerifyingPaymasterAddress',
                            ].includes(key) ||
                            chainConfigs[chainSelected]?.[
                              key as keyof ChainConfig
                            ]
                              ? undefined
                              : 'red',
                        }}
                        onChange={(event) =>
                          updateSpecificChainConfig(
                            chainSelected,
                            key as keyof ChainConfig,
                            event.target.value,
                          )
                        }
                      />
                    </>
                  );
                },
              )}
            </StyledBox>
          )}

          <button
            data-testid="set-chain-config-btn"
            type="button"
            onClick={async () => updateChainConfig()}
          >
            Set Chain Config
          </button>
        </ChainConfigContent>
      </ChainConfigItem>
    </ChainConfigContainer>
  );
};
