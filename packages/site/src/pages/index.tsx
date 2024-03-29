import type { Json } from '@metamask/utils';
import type { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';
import { KeyringSnapRpcClient } from '@metamask/keyring-api';
import Grid from '@mui/material/Grid';
import React, { useContext, useEffect, useState } from 'react';
import { v4 as uuidV4 } from 'uuid'

import { Accordion, AccountList, Card, ConnectButton } from '../components';
import { ChainConfigComponent } from '../components/ChainConfig';
import {
  CardContainer,
  Container,
  Divider,
  DividerTitle,
  StyledBox,
} from '../components/styledComponents';
import { defaultSnapOrigin } from '../config';
import { MetamaskActions, MetaMaskContext } from '../hooks';
import { InputType } from '../types';
import type { KeyringState } from '../utils';
import { connectSnap, getSnap } from '../utils';

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

const Index = () => {
  const [state, dispatch] = useContext(MetaMaskContext);
  const [snapState, setSnapState] = useState<KeyringState>(initialState);
  // Is not a good practice to store sensitive data in the state of
  // a component but for this case it should be ok since this is an
  // internal development and testing tool.
  const [privateKey, setPrivateKey] = useState<string | null>();
  const [salt, setSalt] = useState<string | null>();

  const [transferToken, setTransferToken] = useState<string | null>('ETH');
  const [targetAccount, setTargetAccount] = useState<string | null>('0xcF044AB1e5b55203dC258F47756daFb7F8F01760');
  const [transferAmount, setTransferAmount] = useState<string | null>('2');
  const [greetMessage, setGreetMessage] = useState<string | null>('Hello Snaps!');


  const [accountId, setAccountId] = useState<string | null>();
  const [accountObject, setAccountObject] = useState<string | null>();

  const client = new KeyringSnapRpcClient(snapId, window.ethereum);

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
      console.log(`accounts loaded!`, accounts)
      // listRequests
      setSnapState({
        ...state,
        accounts,
        usePaymaster: false,
      });
    }

    getState().catch((error) => console.error(error));

  }, [state.installedSnap]);

  const syncAccounts = async () => {
    const accounts = await client.listAccounts();
    setSnapState({
      ...snapState,
      accounts,
    });
  };

  const createAccount = async () => {
    const newAccount = await client.createAccount({
      privateKey: privateKey as string,
      salt: salt as string,
    });
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

  const sendBobaTx = async () => {
    if (!snapState || !snapState.accounts) {
      return false;
    }

    const transactionDetails: Record<string, any> = {
      payload: {
        to: targetAccount,
        value: transferAmount,
        data: '0x'
      },
      account: snapState.accounts[0]?.id || '',
      scope: "eip155:11155111"
    };

    console.log(snapState);

    let method = 'snap.internal.sendBoba';
    if (isPaymaster) {
      method = 'snap.internal.sendBobaPM',
    }

    let submitRes = await window.ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: defaultSnapOrigin,
        request: {
          method,
          params: [transactionDetails],
          id: snapState.accounts[0]?.id || '',
        },
      },
    })

    console.log(`submitRes`, submitRes);
    return submitRes;
  };

  const publishMessage = async () => {
    if (!snapState || !snapState.accounts) {
      return false;
    }

    const msgDetail: Record<string, Json> = {
      accountAddress: snapState?.accounts[0]?.address || '',
      message: greetMessage,
      data: '0x',
    };
    const greetResponse = await window.ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: defaultSnapOrigin,
        request: {
          method: 'snap.internal.newGreet',
          params: [msgDetail]
        },
      },
    });


    console.log(`greetResponse`, greetResponse);
    return greetResponse;
  };


  const handleConnectClick = async () => {
    try {
      await connectSnap();
      const installedSnap = await getSnap();

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
        label: 'Create Account',
      },
      successMessage: 'Smart Contract Account Created',
    },
    {
      name: 'Transfer Funds',
      description: 'Transfer fund with boba as fee token!',
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
      ],
      action: {
        callback: async () => await sendBobaTx(),
        label: 'Transfer',
      },
      successMessage: 'Funds transfer successful!',
    },
    {
      name: 'Test keyring client call',
      description: 'Call hello world snap!',
      inputs: [
        {
          id: 'client-call-message',
          title: 'Transfer To Account',
          value: greetMessage,
          type: InputType.TextField,
          placeholder: 'eg. hello world',
          onChange: (event: any) => setGreetMessage(event.currentTarget.value),
        }
      ],
      action: {
        callback: async () => await publishMessage(),
        label: 'Say hello!',
      },
      successMessage: 'Greeting send!',
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
      <CardContainer>
        {!state.installedSnap && (
          <Card
            content={{
              title: 'Connect',
              description:
                'Get started by connecting to and installing the snap.',
              button: (
                <ConnectButton
                  onClick={handleConnectClick}
                  disabled={!state.hasMetaMask}
                />
              ),
            }}
            disabled={!state.hasMetaMask}
          />
        )}
      </CardContainer>

      <StyledBox sx={{ flexGrow: 1 }}>
        <Grid alignItems="flex-start" container spacing={4} columns={[1, 2, 3]}>
          <Grid item xs={8} sm={4} md={2}>
            <DividerTitle>Methods</DividerTitle>
            <Accordion items={accountManagementMethods} />
            <Divider />
            <DividerTitle>Snap Configuration</DividerTitle>
            <ChainConfigComponent client={client} />
            <Divider />
          </Grid>
          <Grid item xs={4} sm={2} md={1}>
            <Divider />
            <DividerTitle>Accounts</DividerTitle>
            <AccountList
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
      </StyledBox>
    </Container>
  );
};

export default Index;
