import type { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';
import { KeyringSnapRpcClient } from '@metamask/keyring-api';
import Grid from '@mui/material/Grid';
import React, { useContext, useEffect, useState } from 'react';
import * as uuid from 'uuid';

import { Accordion, AccountList, Card, ConnectButton } from '../components';
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
import { connectSnap, getSnap, isSynchronousMode } from '../utils';

const snapId = defaultSnapOrigin;

const initialState: {
  pendingRequests: KeyringRequest[];
  accounts: KeyringAccount[];
  useSynchronousApprovals: boolean;
} = {
  pendingRequests: [],
  accounts: [],
  useSynchronousApprovals: true,
};

const Index = () => {
  const [state, dispatch] = useContext(MetaMaskContext);
  const [snapState, setSnapState] = useState<KeyringState>(initialState);
  // Is not a good practice to store sensitive data in the state of
  // a component but for this case it should be ok since this is an
  // internal development and testing tool.
  const [privateKey, setPrivateKey] = useState<string | null>();
  const [salt, setSalt] = useState<string | null>();
  const [accountId, setAccountId] = useState<string | null>();
  const [accountObject, setAccountObject] = useState<string | null>();
  const [requestId, setRequestId] = useState<string | null>(null);
  // const [accountPayload, setAccountPayload] =
  //   useState<Pick<KeyringAccount, 'name' | 'options'>>();
  // UserOp method state
  const [chainConfig, setChainConfigObject] = useState<string | null>();
  const [transactionsObject, setTransactionsObject] = useState<string | null>();
  const [userOpObject, setUserOpObject] = useState<string | null>();

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
      const pendingRequests = await client.listRequests();
      const isSynchronous = await isSynchronousMode();
      setSnapState({
        accounts,
        pendingRequests,
        useSynchronousApprovals: isSynchronous,
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

  // UserOp methods (default to send from first AA account created)
  const setChainConfig = async () => {
    if (!chainConfig) {
      return;
    }
    const request: KeyringRequest = {
      id: uuid.v4(),
      scope: '',
      account: uuid.v4(),
      request: {
        method: 'snap.internal.setConfig',
        params: [JSON.parse(chainConfig)],
      },
    };
    await client.submitRequest(request);
  };
  const prepareUserOp = async () => {
    if (!transactionsObject || !snapState.accounts[0]) {
      return;
    }
    const request: KeyringRequest = {
      id: '',
      scope: '',
      account: snapState.accounts[0]?.id ?? '',
      request: {
        method: 'eth_prepareUserOperation',
        params: [JSON.stringify(transactionsObject)],
      },
    };
    await client.submitRequest(request);
  };

  const patchUserOp = async () => {
    if (!userOpObject || !snapState.accounts[0]) {
      return;
    }
    const request: KeyringRequest = {
      id: '',
      scope: '',
      account: snapState.accounts[0]?.id ?? '',
      request: {
        method: 'eth_patchUserOperation',
        params: [JSON.stringify(userOpObject)],
      },
    };
    await client.submitRequest(request);
  };

  const signUserOp = async () => {
    if (!userOpObject || !snapState.accounts[0]) {
      return;
    }
    const request: KeyringRequest = {
      id: '',
      scope: '',
      account: snapState.accounts[0]?.id ?? '',
      request: {
        method: 'eth_signUserOperation',
        params: [JSON.stringify(userOpObject)],
      },
    };
    await client.submitRequest(request);
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

  // Note: not using this for now
  // const handleUseSyncToggle = useCallback(async () => {
  //   console.log('Toggling synchronous approval');
  //   await toggleSynchronousApprovals();
  //   setSnapState({
  //     ...snapState,
  //     useSynchronousApprovals: !snapState.useSynchronousApprovals,
  //   });
  // }, [snapState]);

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
      name: 'Get account',
      description: 'Get data of the selected account',
      inputs: [
        {
          id: 'get-account-account-id',
          title: 'Account ID',
          type: InputType.TextField,
          placeholder: 'E.g. f59a9562-96de-4e75-9229-079e82c7822a',
          options: snapState.accounts.map((account) => {
            return { value: account.address };
          }),
          onChange: (event: any) => setAccountId(event.currentTarget.value),
        },
      ],
      action: {
        disabled: Boolean(accountId),
        callback: async () => await client.getAccount(accountId as string),
        label: 'Get Account',
      },
      successMessage: 'Account fetched',
    },
    {
      name: 'List accounts',
      description: 'List all account managed by the SSK',
      action: {
        disabled: false,
        callback: async () => {
          const accounts = await client.listAccounts();
          setSnapState({
            ...snapState,
            accounts,
          });
          return accounts;
        },
        label: 'List Accounts',
      },
    },
    {
      name: 'Remove account',
      description: 'Remove an account',
      inputs: [
        {
          id: 'delete-account-account-id',
          title: 'Account ID',
          type: InputType.TextField,
          placeholder: 'E.g. 394bd587-7be4-4ffb-a113-198c6a7764c2',
          options: snapState.accounts.map((account) => {
            return { value: account.address };
          }),
          onChange: (event: any) => setAccountId(event.currentTarget.value),
        },
      ],
      action: {
        disabled: Boolean(accountId),
        callback: async () => await deleteAccount(),
        label: 'Remove Account',
      },
      successMessage: 'Account Removed',
    },
    {
      name: 'Update account',
      description: 'Update an account',
      inputs: [
        {
          id: 'update-account-account-object',
          title: 'Account Object',
          type: InputType.TextArea,
          placeholder: 'E.g. { id: ... }',
          onChange: (event: any) => setAccountObject(event.currentTarget.value),
        },
      ],
      action: {
        disabled: Boolean(accountId),
        callback: async () => await updateAccount(),
        label: 'Update Account',
      },
      successMessage: 'Account Updated',
    },
  ];

  const requestMethods = [
    {
      name: 'Get request',
      description: 'Get a pending request by ID',
      inputs: [
        {
          id: 'get-request-request-id',
          title: 'Request ID',
          type: InputType.TextField,
          placeholder: 'E.g. e5156958-16ad-4d5d-9dcd-6a8ba1d34906',
          onChange: (event: any) => setRequestId(event.currentTarget.value),
        },
      ],
      action: {
        enabled: Boolean(requestId),
        callback: async () => await client.getRequest(requestId as string),
        label: 'Get Request',
      },
    },
    {
      name: 'List requests',
      description: 'List pending requests',
      action: {
        disabled: false,
        callback: async () => {
          const requests = await client.listRequests();
          setSnapState({
            ...snapState,
            pendingRequests: requests,
          });
          return requests;
        },
        label: 'List Requests',
      },
    },
    {
      name: 'Approve request',
      description: 'Approve a pending request by ID',
      inputs: [
        {
          id: 'approve-request-request-id',
          title: 'Request ID',
          type: InputType.TextField,
          placeholder: 'E.g. 6fcbe1b5-f250-452c-8114-683dfa5ea74d',
          onChange: (event: any) => {
            setRequestId(event.currentTarget.value);
          },
        },
      ],
      action: {
        disabled: !requestId,
        callback: async () => await client.approveRequest(requestId as string),
        label: 'Approve Request',
      },
      successMessage: 'Request approved',
    },
    {
      name: 'Reject request',
      description: 'Reject a pending request by ID',
      inputs: [
        {
          id: 'reject-request-request-id',
          title: 'Request ID',
          type: InputType.TextField,
          placeholder: 'E.g. 424ad2ee-56cf-493e-af82-cee79c591117',
          onChange: (event: any) => {
            setRequestId(event.currentTarget.value);
          },
        },
      ],
      action: {
        disabled: !requestId,
        callback: async () => await client.rejectRequest(requestId as string),
        label: 'Reject Request',
      },
      successMessage: 'Request Rejected',
    },
  ];

  const userOpMethods = [
    {
      name: 'Set Chain Config',
      description:
        'Set account abstraction configuration options for the current chain.',
      inputs: [
        {
          id: 'set-chain-config-chain-config-object',
          title: 'Chain Config Object',
          type: InputType.TextArea,
          placeholder:
            '{\n' +
            '    "simpleAccountFactory": "0x97a0924bf222499cBa5C29eA746E82F230730293",\n' +
            '    "entryPoint": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",\n' +
            '    "bundlerUrl": "https://bundler.example.com/rpc",\n' +
            '    "customVerifyingPaymasterPK": "abcd1234qwer5678tyui9012ghjk3456zxcv7890",\n' +
            '    "customVerifyingPaymasterAddress": "0x123456789ABCDEF0123456789ABCDEF012345678"\n' +
            '}',
          onChange: (event: any) =>
            setChainConfigObject(event.currentTarget.value),
        },
      ],
      action: {
        disabled: Boolean(accountId),
        callback: async () => await setChainConfig(),
        label: 'Set Chain Configs',
      },
      successMessage: 'Chain Config Set',
    },
    {
      name: 'Prepare UserOp',
      description: 'Input Transaction array to Prepare UserOp',
      inputs: [
        {
          id: 'prepare-user-op-transactions-object',
          title: 'Transactions Object Array',
          type: InputType.TextArea,
          placeholder:
            '[\n' +
            '    {\n' +
            '      "to": "0x0c54fccd2e384b4bb6f2e405bf5cbc15a017aafb",\n' +
            '      "value": "0x0",\n' +
            '      "data": "0x"\n' +
            '    },\n' +
            ']',
          onChange: (event: any) =>
            setTransactionsObject(event.currentTarget.value),
        },
      ],
      action: {
        disabled: Boolean(accountId),
        callback: async () => await prepareUserOp(),
        label: 'Prepare UserOp',
      },
      successMessage: 'UserOp Prepared',
    },
    {
      name: 'Patch UserOp',
      description: 'Input User Operation object to Patch UserOp',
      inputs: [
        {
          id: 'patch-user-op-userOp-object',
          title: 'UserOp Object',
          type: InputType.TextArea,
          placeholder:
            '{\n' +
            '  "sender": "0x4584d2B4905087A100420AFfCe1b2d73fC69B8E4",\n' +
            '  "nonce": "0x1",\n' +
            '  "initCode": "0x",\n' +
            '  "callData": "0x70641a22000000000000000000000000f3de3...",\n' +
            '  "callGasLimit": "0x58a83",\n' +
            '  "verificationGasLimit": "0xe8c4",\n' +
            '  "preVerificationGas": "0xc57c",\n' +
            '  "maxFeePerGas": "0x87f0878c0",\n' +
            '  "maxPriorityFeePerGas": "0x1dcd6500",\n' +
            '  "paymasterAndData": "0x00000000000000000000...",\n' +
            '  "signature": "0x00000000000000000000000..."\n' +
            '}',
          onChange: (event: any) => setUserOpObject(event.currentTarget.value),
        },
      ],
      action: {
        disabled: Boolean(accountId),
        callback: async () => await patchUserOp(),
        label: 'Patch UserOp',
      },
      successMessage: 'UserOp Patched',
    },
    {
      name: 'Sign UserOp',
      description: 'Input User Operation object to Sign UserOp',
      inputs: [
        {
          id: 'sign-user-op-userOp-object',
          title: 'UserOp Object',
          type: InputType.TextArea,
          placeholder:
            '{\n' +
            '  "sender": "0x4584d2B4905087A100420AFfCe1b2d73fC69B8E4",\n' +
            '  "nonce": "0x1",\n' +
            '  "initCode": "0x",\n' +
            '  "callData": "0x70641a22000000000000000000000000f3de...",\n' +
            '  "callGasLimit": "0x58a83",\n' +
            '  "verificationGasLimit": "0xe8c4",\n' +
            '  "preVerificationGas": "0xc57c",\n' +
            '  "maxFeePerGas": "0x87f0878c0",\n' +
            '  "maxPriorityFeePerGas": "0x1dcd6500",\n' +
            '  "paymasterAndData": "0x952514d7cBCB495EACeB86e021...",\n' +
            '  "signature": "0x"\n' +
            '},\n' +
            '"0xEntryPointAddress"',
          onChange: (event: any) => setUserOpObject(event.currentTarget.value),
        },
      ],
      action: {
        disabled: Boolean(accountId),
        callback: async () => await signUserOp(),
        label: 'Sign UserOp',
      },
      successMessage: 'UserOp Signed',
    },
  ];

  return (
    <Container>
      <CardContainer>
        {!state.installedSnap && (
          <Card
            content={{
              title: 'Connect',
              description:
                'Get started by connecting to and installing the example snap.',
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
        <Grid container spacing={4} columns={[1, 2, 3]}>
          <Grid item xs={8} sm={4} md={2}>
            {/* Not using this for now*/}
            {/* <DividerTitle>Options</DividerTitle>*/}
            {/* <Toggle*/}
            {/*  title="Use Synchronous Approval"*/}
            {/*  defaultChecked={snapState.useSynchronousApprovals}*/}
            {/*  onToggle={handleUseSyncToggle}*/}
            {/*  enabled={Boolean(state.installedSnap)}*/}
            {/*/ >*/}
            {/* <Divider>&nbsp;</Divider>*/}
            <DividerTitle>Methods</DividerTitle>
            <Accordion items={accountManagementMethods} />
            <Divider />
            <DividerTitle>UserOp Methods</DividerTitle>
            <Accordion items={userOpMethods} />
            <Divider />
            <DividerTitle>Request Methods</DividerTitle>
            <Accordion items={requestMethods} />
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
