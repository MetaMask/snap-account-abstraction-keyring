import type { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';
import { KeyringSnapRpcClient } from '@metamask/keyring-api';
import Grid from '@mui/material/Grid';
import { ethers, parseUnits } from 'ethers';
import React, { useContext, useEffect, useState } from 'react';

import { Accordion, AccountList, Card, ConnectButton, InstallHcSnapButton } from '../components';
import {
  CardContainer,
  Container,
  Divider,
  DividerTitle,
  StyledBox,
} from '../components/styledComponents';
import { defaultSnapOrigin } from '../config';
import { MetaMaskContext, MetamaskActions } from '../hooks';
import { InputType } from '../types';
import type { KeyringState } from '../utils';
import { connectSnap, getSnap, loadAccountConnected } from '../utils';

const snapId = defaultSnapOrigin;

const initialState: {
  pendingRequests: KeyringRequest[];
  accounts: KeyringAccount[];
  usePaymaster: boolean;
} = {
  pendingRequests: [],
  accounts: [],
  usePaymaster: false,
};

const tokenList = {
  Boba: {
    symbol: 'BOBA',
    decimals: 18

  },
  ETH: {
    symbol: 'ETH',
    decimals: 18
  },
  USDC: {
    symbol: 'USDC',
    decimals: 6
  }
}

// TODO: used shared address file on the gateway
const TOKEN_ADDR: any = {
  288: {
    bobaToken: '0xa18bF3994C0Cc6E3b63ac420308E5383f53120D7',
    usdcToken: '0x66a2A913e447d6b4BF33EFbec43aAeF87890FBbc',
    paymaster: '',
  },
  11155111: {
    bobaToken: '0x33faF65b3DfcC6A1FccaD4531D9ce518F0FDc896',
    usdcToken: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    paymaster: '0x0ebB672Aec2b82108542E29875669770EBcB7066',
  },
  28882: {
    bobaToken: '0x4200000000000000000000000000000000000023',
    usdcToken: '0x4200000000000000000000000000000000000023',
    paymaster: '0x8223388f7aF211d84289783ed97ffC5Fefa14256',
  },
};

const Index = () => {
  const [state, dispatch] = useContext(MetaMaskContext);
  const [snapState, setSnapState] = useState<KeyringState>(initialState);
  // Is not a good practice to store sensitive data in the state of
  // a component but for this case it should be ok since this is an
  // internal development and testing tool.
  const [privateKey, setPrivateKey] = useState<string | null>();
  const [salt, setSalt] = useState<string | null>();
  const [bobaPaymasterSelected, setBobaPaymasterSelected] = useState<Boolean | null>();

  const [transferToken, setTransferToken] = useState<string | null>('Boba');
  const [targetAccount, setTargetAccount] = useState<string | null>('0xcF044AB1e5b55203dC258F47756daFb7F8F01760');
  const [transferAmount, setTransferAmount] = useState<string>('0.01');


  const [selectedAccount, setSelectedAccount] = useState<KeyringAccount>();
  const [accountId, setAccountId] = useState<string | null>();
  const [accountObject, setAccountObject] = useState<string | null>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [counter, setCounter] = useState<number>(0);

  const client = new KeyringSnapRpcClient(snapId, window.ethereum);
  const abiCoder = new ethers.AbiCoder();

  useEffect(() => {
    /**
     * Return the current state of the snap.
     *
     * @returns The current state of the snap.
     */
    async function getState() {
      if (!state.installedSnap) {
        return;
      }
      const accounts = await client.listAccounts();
      const currentAccount = await loadAccountConnected();
      const account = accounts.find((acc) => acc.address.toLowerCase() === currentAccount.toLowerCase());

      setSelectedAccount(account);

      const saltIndexCount = accounts.filter(
        (account) => account.options?.saltIndex,
      ).length;
      setCounter(saltIndexCount);

      // listRequests
      setSnapState({
        ...state,
        accounts,
        usePaymaster: false,
      });
    }

    getState().catch((error) => console.error(error));

    const listenToAccountChange = async () => {
      window.ethereum.on('accountsChanged', async () => {
        //reset connection
        const accounts = await client.listAccounts();
        const currentAccount = await loadAccountConnected();
        const account = accounts.find((acc) => acc.address.toLowerCase() === currentAccount.toLowerCase());
        setSelectedAccount(account);
        setSnapState({
          ...snapState,
          accounts,
        });
      });

      // change in network.
      window.ethereum.on('networkChanged', function (networkId) {
        // Time to reload your interface with the new networkId
        if (networkId !== 28882) {
          dispatch({
            type: MetamaskActions.SetNetwork,
            payload: false,
          });
        }
      })
    }

    listenToAccountChange().catch((error) => console.error(error));

  }, [state.installedSnap]);

  const syncAccounts = async () => {
    const accounts = await client.listAccounts();
    setSnapState({
      ...snapState,
      accounts,
    });
  };

  const createAccount = async () => {
    setIsLoading(true);
    try {
      const newAccount = await client.createAccount({
        privateKey: privateKey as string,
        salt: salt as string,
      });
      await syncAccounts();
      setIsLoading(false);
      return newAccount;
    } catch (error) {
      setIsLoading(false);
      return error;
    }
  };

  const createAccountDeterministic = async () => {
    const newAccount = await client.createAccount({
      saltIndex: counter.toString(),
    });
    setCounter(counter + 1);
    await syncAccounts();
    return newAccount;
  };

  const deleteAccount = async () => {
    await client.deleteAccount(accountId as string);
    await syncAccounts();
  };

  const updateAccount = async () => {
    if (!accountObject) {
      return;
    }
    const account: KeyringAccount = JSON.parse(accountObject);
    await client.updateAccount(account);
    await syncAccounts();
  };

  const sendCustomTx = async (target: any, value: string, txData: string, paymasterOverride: boolean) => {
    if (!snapState || !snapState.accounts) {
      return false;
    }

    const currentChainId = (await window.ethereum.request({
      method: 'eth_chainId',
    })) as string;
    const currentChainIdInt = parseInt(currentChainId, 16);

    let transactionDetails: Record<string, any> = {
      payload: {
        to: target,
        value: value,
        data: txData,
      },
      account: selectedAccount?.id,
      scope: `eip155:${currentChainIdInt}`,
    };

    let method = 'eth_sendUserOpBoba';

    if (paymasterOverride) {
      method = 'eth_sendUserOpBobaPM';
    }
    console.log({
      method: 'wallet_invokeSnap',
      params: {
        snapId: defaultSnapOrigin,
        request: {
          method,
          params: [transactionDetails],
          id: snapState.accounts[0]?.id || '',
        },
      },
    });

    const submitRes = await window.ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: defaultSnapOrigin,
        request: {
          method,
          params: [transactionDetails],
          id: selectedAccount?.id,
        },
      },
    })

    return submitRes;
  };

  const checkDepositOnPaymaster = async () => {
    if (!selectedAccount) {
      return false;
    }
    const currentChainId = (await window.ethereum.request({
      method: 'eth_chainId',
    })) as string;
    const currentChainIdInt = parseInt(currentChainId, 16);

    const data = abiCoder.encode(
      ['address', 'address'],
      [TOKEN_ADDR[currentChainIdInt]?.bobaToken, selectedAccount?.address],
    );

    const callObject = {
      to: TOKEN_ADDR[currentChainIdInt]?.paymaster,
      data: ethers.hexlify(ethers.concat([ethers.FunctionFragment.getSelector("depositInfo", ["address", "address"]), data]))
    };
    const depositInfo = await window.ethereum.request({
      method: 'eth_call',
      params: [callObject, 'latest']
    });

    const decodedData = abiCoder.decode(
      ['uint256', 'uint256'],
      depositInfo as any
    );

    const depositAmount = decodedData[0];

    console.log('deposit amount', depositAmount)

    const hasSufficientDeposit = depositAmount >= (ethers.parseEther('1'));
    return hasSufficientDeposit;
  };

  const setUpPaymaster = async () => {
    if (!selectedAccount) {
      return false;
    }

    const currentChainId = (await window.ethereum.request({
      method: 'eth_chainId',
    })) as string;
    const currentChainIdInt = parseInt(currentChainId, 16);

    const funcSelector = ethers.FunctionFragment.getSelector("addDepositFor", ["address", "address", "uint256"]);

    const encodedParams = abiCoder.encode(
      ['address', 'address', 'uint256'],
      [TOKEN_ADDR[currentChainIdInt]?.bobaToken, selectedAccount?.address, ethers.parseEther('1')],
    );

    const txData = ethers.hexlify(ethers.concat([funcSelector, encodedParams]));

    await sendCustomTx(TOKEN_ADDR[currentChainIdInt]?.paymaster, '0', txData, false)
  };

  const checkApproval = async () => {

    if (!selectedAccount) {
      return false;
    }

    const currentChainId = (await window.ethereum.request({
      method: 'eth_chainId',
    })) as string;
    const currentChainIdInt = parseInt(currentChainId, 16);

    const data = abiCoder.encode(
      ['address', 'address'],
      [selectedAccount?.address, TOKEN_ADDR[currentChainIdInt]?.paymaster],
    );

    const callObject = {
      to: TOKEN_ADDR[currentChainIdInt]?.bobaToken,
      data: ethers.hexlify(ethers.concat([ethers.FunctionFragment.getSelector("allowance", ["address", "address"]), data]))
    };
    const allowance = await window.ethereum.request({
      method: 'eth_call',
      params: [callObject, 'latest']
    });
    const allowanceBigNumber = ethers.toBigInt(allowance as any);
    console.log('allowance ', allowanceBigNumber)

    const hasSufficientApproval = allowanceBigNumber >= (ethers.parseEther('50000'));
    return hasSufficientApproval;
  };

  const approveBobaSpend = async () => {
    const currentChainId = (await window.ethereum.request({
      method: 'eth_chainId',
    })) as string;
    const currentChainIdInt = parseInt(currentChainId, 16);

    const funcSelector = ethers.FunctionFragment.getSelector("approve", ["address", "uint256"]);
    const paymasterAddr = TOKEN_ADDR[currentChainIdInt]?.paymaster;
    const amount = ethers.MaxUint256;

    const encodedParams = abiCoder.encode(
      ['address', 'uint256'],
      [paymasterAddr, amount],
    );

    const txData = ethers.hexlify(ethers.concat([funcSelector, encodedParams]));

    await sendCustomTx(TOKEN_ADDR[currentChainIdInt]?.bobaToken, '0', txData, false)
  };

  const sendBobaTx = async () => {
    if (!snapState || !snapState.accounts || !selectedAccount) {
      return false;
    }

    // Paymaster Setup steps (only first time or when required)
    if (bobaPaymasterSelected) {
      const hasSufficientApproval = await checkApproval();
      if (!hasSufficientApproval) {
        console.log('Does not have sufficient approval');
        await approveBobaSpend();

        // TODO: wait here before the change reflects on-chain
      }

      const hasSufficientDeposit = await checkDepositOnPaymaster();
      if (!hasSufficientDeposit) {
        await setUpPaymaster();

        // TODO: wait here before the change reflects on-chain
      }
    }

    const currentChainId = window.ethereum.chainId as string;

    const currentChainIdInt = parseInt(currentChainId, 16);

    let transactionDetails: Record<string, any> = {
      payload: {
        to: targetAccount,
        value: parseUnits(transferAmount, 'ether').toString(), // as it's ethers
        data: '0x'
      },
      account: selectedAccount?.id,
      scope: `eip155:${currentChainIdInt}`,
    };

    if (transferToken !== 'ETH') {
      let tokenAddress;
      let tokenAmount;
      if (transferToken === 'Boba') {
        tokenAddress = TOKEN_ADDR[currentChainIdInt]?.bobaToken;
        tokenAmount = parseUnits(transferAmount, tokenList.Boba.decimals)
      } else if (transferToken === 'USDC') {
        tokenAddress = TOKEN_ADDR[currentChainIdInt]?.usdcToken;
        tokenAmount = parseUnits(transferAmount, tokenList.USDC.decimals)
      }

      // TODO: use ethers
      const transferFunctionSelector = '0xa9059cbb';
      const txData =
        transferFunctionSelector +
        targetAccount?.slice(2).padStart(64, '0') +
        (Number(tokenAmount).toString(16)).padStart(64, '0');

      transactionDetails = {
        payload: {
          to: tokenAddress,
          value: '0',
          data: txData,
        },
        account: selectedAccount,
        scope: `eip155:${currentChainIdInt}`,
      };
    }

    let method = 'eth_sendUserOpBoba';

    if (bobaPaymasterSelected) {
      method = 'eth_sendUserOpBobaPM';
    }
    console.log({
      method: 'wallet_invokeSnap',
      params: {
        snapId: defaultSnapOrigin,
        request: {
          method,
          params: [transactionDetails],
          id: snapState.accounts[0]?.id || '',
        },
      }
    })

    let submitRes = await window.ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: defaultSnapOrigin,
        request: {
          method,
          params: [transactionDetails],
          id: selectedAccount?.id,
        },
      },
    })

    return submitRes;
  };

  const handleConnectClick = async () => {
    try {
      await connectSnap();
      const installedSnap = await getSnap();

      dispatch({
        type: MetamaskActions.SetNetwork,
        payload: true,
      });

      dispatch({
        type: MetamaskActions.SetInstalled,
        payload: installedSnap,
      });
    } catch (error) {
      console.error(error);
      dispatch({ type: MetamaskActions.SetError, payload: error });
    }
  };

  const accountManagementMethods = [
    {
      name: 'Create account',
      description: 'Create a 4337 account using an admin private key',
      inputs: [
        {
          id: 'create-account-private-key',
          title: 'Private key',
          value: privateKey,
          type: InputType.TextField,
          placeholder:
            'E.g. 0000000000000000000000000000000000000000000000000000000000000000',
          onChange: (event: any) => setPrivateKey(event.currentTarget.value),
        },
        {
          id: 'create-account-salt',
          title: 'Salt (optional)',
          value: salt,
          type: InputType.TextField,
          placeholder: 'E.g. 0x123',
          onChange: (event: any) => setSalt(event.currentTarget.value),
        },
      ],
      action: {
        callback: async () => await createAccount(),
        label: `Create Account`,
        disabled: isLoading
      },
      successMessage: 'Smart Contract Account Created',
    },
    {
      name: 'Create account (Deterministic)',
      description:
        'Create a 4337 account using a deterministic key generated through the snap',
      inputs: [
        {
          id: 'create-account-deterministic',
          title: 'Counter',
          value: counter.toString(),
          type: InputType.TextField,
          onChange: () => {},
        },
      ],
      action: {
        callback: async () => await createAccountDeterministic(),
        label: 'Create Account',
      },
      successMessage: 'Smart Contract Account Created',
    },
    {
      name: 'Transfer Funds',
      description: 'Transfer funds from your Smart Account',
      inputs: [
        {
          id: 'transfer-fund-select-token',
          title: 'Select Token',
          value: transferToken,
          type: InputType.Dropdown,
          options: [
            {
              value: 'Boba',
              key: 'Boba',
            },
            {
              value: 'USDC',
              key: 'USDC',
            },
            {
              value: 'ETH',
              key: 'ETH',
            },
            // TODO: add custom token option
          ],
          placeholder: 'E.g. ETH',
          onChange: (event: any) => setTransferToken(event.currentTarget.value),
        },
        {
          id: 'transfer-fund-to-address',
          title: 'Transfer To Account',
          value: targetAccount,
          type: InputType.TextField,
          placeholder: 'E.g. 0x123',
          onChange: (event: any) => setTargetAccount(event.currentTarget.value),
        },
        {
          id: 'transfer-fund-token-amount',
          title: 'Token Amount',
          value: transferAmount,
          type: InputType.TextField,
          placeholder: 'E.g. 0.00',
          onChange: (event: any) => setTransferAmount(event.currentTarget.value),
        },
        {
          id: 'transfer-fund-boba-paymaster',
          title: 'Select boba as paymaster.',
          value: bobaPaymasterSelected,
          type: InputType.CheckBox,
          placeholder: 'E.g. 0.00',
          onChange: (event: any) => setBobaPaymasterSelected(event.target.checked),
        },
      ],
      action: {
        callback: async () => await sendBobaTx(),
        label: 'Transfer',
      },
      successMessage: 'Funds transfer successful!',
    },
    // {
    //   name: 'Get account',
    //   description: 'Get data of the selected account',
    //   inputs: [
    //     {
    //       id: 'get-account-account-id',
    //       title: 'Account ID',
    //       type: InputType.TextField,
    //       placeholder: 'E.g. f59a9562-96de-4e75-9229-079e82c7822a',
    //       options: snapState.accounts.map((account) => {
    //         return { value: account.address };
    //       }),
    //       onChange: (event: any) => setAccountId(event.currentTarget.value),
    //     },
    //   ],
    //   action: {
    //     disabled: Boolean(accountId),
    //     callback: async () => await client.getAccount(accountId as string),
    //     label: 'Get Account',
    //   },
    //   successMessage: 'Account fetched',
    // },
    // {
    //   name: 'List accounts',
    //   description: 'List all account managed by the SSK',
    //   action: {
    //     disabled: false,
    //     callback: async () => {
    //       const accounts = await client.listAccounts();
    //       setSnapState({
    //         ...snapState,
    //         accounts,
    //       });
    //       return accounts;
    //     },
    //     label: 'List Accounts',
    //   },
    // },
    // {
    //   name: 'Remove account',
    //   description: 'Remove an account',
    //   inputs: [
    //     {
    //       id: 'delete-account-account-id',
    //       title: 'Account ID',
    //       type: InputType.TextField,
    //       placeholder: 'E.g. 394bd587-7be4-4ffb-a113-198c6a7764c2',
    //       options: snapState.accounts.map((account) => {
    //         return { value: account.address };
    //       }),
    //       onChange: (event: any) => setAccountId(event.currentTarget.value),
    //     },
    //   ],
    //   action: {
    //     disabled: Boolean(accountId),
    //     callback: async () => await deleteAccount(),
    //     label: 'Remove Account',
    //   },
    //   successMessage: 'Account Removed',
    // },
    // {
    //   name: 'Update account',
    //   description: 'Update an account',
    //   inputs: [
    //     {
    //       id: 'update-account-account-object',
    //       title: 'Account Object',
    //       type: InputType.TextArea,
    //       placeholder: 'E.g. { id: ... }',
    //       onChange: (event: any) => setAccountObject(event.currentTarget.value),
    //     },
    //   ],
    //   action: {
    //     disabled: Boolean(accountId),
    //     callback: async () => await updateAccount(),
    //     label: 'Update Account',
    //   },
    //   successMessage: 'Account Updated',
    // },
  ];

  return (
    <Container>
      {!state.isBobaSepolia ? (
        <CardContainer>
          <Card
            content={{
              description:
                'Please connect to Boba to use HC AA wallet app',
              button: (
                <ConnectButton
                  onClick={handleConnectClick}
                  disabled={!state.hasMetaMask}
                />
              ),
            }}
            disabled={!state.hasMetaMask}
          />
        </CardContainer>
      ) : !state.installedSnap ? (
        <CardContainer>
          <Card
            content={{
              title: 'Connect',
              description:
                'Get started by connecting to and installing the snap.',
              button: (
                <InstallHcSnapButton
                  onClick={handleConnectClick}
                  disabled={!state.hasMetaMask}
                />
              ),
            }}
            disabled={!state.hasMetaMask}
          />
        </CardContainer>
      ) : <></>}

      {state.installedSnap && state.isBobaSepolia && (<StyledBox sx={{ flexGrow: 1 }}>
        <Grid alignItems="flex-start" container spacing={4} columns={[1, 2, 3]}>
          <Grid item xs={8} sm={4} md={2}>
            <DividerTitle>Methods</DividerTitle>
            <Accordion items={accountManagementMethods} />
          </Grid>
          <Grid item xs={4} sm={2} md={1}>
            <Divider />
            <DividerTitle>Accounts</DividerTitle>
            <AccountList
              currentAccount={selectedAccount as any}
              accounts={snapState.accounts}
              handleDelete={async (accountIdToDelete) => {
                await client.deleteAccount(accountIdToDelete);
                const accounts = await client.listAccounts();
                setSnapState({
                  ...snapState,
                  accounts,
                });
              }}
            />
          </Grid>
        </Grid>
      </StyledBox>)}
    </Container>
  );
};

export default Index;
