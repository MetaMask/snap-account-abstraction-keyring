import type { KeyringAccount, KeyringRequest } from '@metamask/keyring-api';
import { KeyringSnapRpcClient } from '@metamask/keyring-api';
import Grid from '@mui/material/Grid';
import React, { useCallback, useContext, useEffect, useState } from 'react';

import {
  Accordion,
  AccountList,
  Card,
  ConnectButton,
  Toggle,
} from '../components';
import { ChainConfigComponent } from '../components/ChainConfig';
// import { PaymasterDeployer } from '../components/PaymasterDeployer';
import {
  CardContainer,
  Divider,
  DividerTitle,
  StyledBox,
} from '../components/styledComponents';
import { defaultSnapOrigin } from '../config';
import { MetamaskActions, MetaMaskContext } from '../hooks';
import { InputType } from '../types';
import type { KeyringState } from '../utils';
import {
  connectSnap,
  getSnap,
  isUsingPaymaster,
  togglePaymasterUsage,
} from '../utils';

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
  const [salt, setSalt] = useState<string | null>('0x123');
  const [accountId, setAccountId] = useState<string | null>();
  const [accountObject, setAccountObject] = useState<string | null>();
  const [pageNum, setPageNum] = useState<number>(0);

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
      const usePaymaster = await isUsingPaymaster();
      setSnapState({
        ...state,
        accounts,
        usePaymaster,
      });
    }

    getState().catch((error) => console.error(error));
  }, [state.installedSnap]);

  const handleUsePaymasterToggle = useCallback(async () => {
    await togglePaymasterUsage();
    setSnapState({
      ...snapState,
      usePaymaster: !snapState.usePaymaster,
    });
  }, [snapState]);

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

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noreferrer');
  };

  const pages = [
    {
      title: 'Save Automatically',
      subtitle: 'with Every Transaction',

      text: (
        <p className="text-3xl my-6 text-black">
          Start saving effortlessly using Coinbase Smart Wallet and pay via
          Stripe.
        </p>
      ),
      btn: 'Get started',
      img: '/piggy.png',
    },
    {
      title: 'Step 1',
      subtitle: 'Install Snap',
      text: (
        <div className="text-3xl my-6 text-black">
          <ul className="list-disc list-inside space-y-4">
            <li>
              YOU MUST USE{' '}
              <a
                href="https://github.com/MetaMask/metamask-extension/pull/25098#issuecomment-2196458627"
                target="_blank"
                className="font-bold underline"
              >
                THIS VERSION
              </a>{' '}
              of Metamask/Flask.
            </li>
            <li> Install it on a Chrome profile without any other Metamask.</li>
            <li>Then click the button below to install.</li>
            <li>
              It will open up a few setup screens, like the one to the right.
            </li>
            <li>
              You are giving permission to install the Snap into your Metamask.
            </li>
          </ul>
        </div>
      ),
      btn: 'Install Snap',
      img: '/install-perms.png',
      btnAction: async () => {
        await handleConnectClick();
      },
    },
    {
      title: 'Step 2',
      subtitle: 'Select Saving Percentage',
      text: (
        <p className="text-3xl my-6 text-black">
          Choose the percentage of each transaction you'd like to Save.
        </p>
      ),
      beforeBtn: (
        <div className="text-6xl text-black">
          <label htmlFor="savingsPct">Select percent to save:</label>
          <select id="savingsPct" name="savingsPct">
            <option value="_0">0%</option>
            <option value="_10">10%</option>
            <option value="_20">20%</option>
            <option value="_30">30%</option>
            <option value="_40">40%</option>
            <option value="_50">50%</option>
            <option value="_60">60%</option>
            <option value="_70">70%</option>
            <option value="_80">80%</option>
            <option value="_90">90%</option>
            <option value="_100">100%</option>
          </select>
        </div>
      ),
      btn: 'Set Percentage',
      img: '/select-pct.png',
    },
    {
      title: 'Step 3',
      subtitle: 'Setup Subscription',
      text: (
        <p className="text-3xl my-6 text-black">
          Sign up for $5 per month to get gas-less transactions, auto savings,
          and monthly reports.
        </p>
      ),
      btn: 'Hell ya, sign me up!',
      img: '/credit-card.png',
      btnAction: async () => {
        openInNewTab('https://buy.stripe.com/test_aEU7vH5ni3rw5nqaEE');
      },
    },
    {
      title: 'Step 4',
      subtitle: 'Create savings account',
      text: (
        <p className="text-3xl my-6 text-black">
          Click the button below to create your new savings account. It will pop
          up a Metamask window to confirm the transaction.
        </p>
      ),
      beforeBtn: (
        <div className="text-6xl text-black mt-6">
          <label htmlFor="ownerPrivateKey">Owner private key:</label>
          <input
            id="ownerPrivateKey"
            type="text"
            className="w-full text-3xl"
            onChange={(event: any) => setPrivateKey(event.currentTarget.value)}
          />
        </div>
      ),
      btn: 'Create Account',
      img: '/create-account.png',
      btnAction: async () => {
        await createAccount();
      },
      skip: true,
    },
    {
      title: 'Step 5',
      subtitle: 'Fund Your New Account',
      text: (
        <div className="my-6 text-black space-y-4">
          <p className="text-3xl">
            Send money to your new savings account address so you can start
            saving while you spend.
          </p>
          <p className="text-3xl font-bold">
            Your address: 0x6335e0a045190ffefa22173bdf9cc4bde8191262
          </p>
        </div>
      ),
      btn: 'Copy address',
      img: '/transfer.png',
    },
    {
      title: 'Step 6',
      subtitle: 'Start Using Your New Account',
      text: (
        <p className="text-3xl my-6 text-black">
          Switch to your account in Metamask and transact anywhere on chain
        </p>
      ),
      btn: 'View savings',
      img: '/switch-wallet.png',
    },
  ];

  if (pageNum >= pages.length) {
    return (
      <div className="p-24 bg-[url('/background.png')] bg-cover text-5xl text-black space-y-4">
        <div className="flex flex-row justify-between rounded-md bg-[#4C4EDD]/50 p-6">
          <div className="w-1/3">
            <p className="font-bold">Available balance</p>
            <p>0 ETH</p>
          </div>
          <div className="w-1/3">
            <p className="font-bold">Saving percent</p>
            <p>10%</p>
          </div>
          <div className="w-1/3">
            <p className="font-bold">Amount saved</p>
            <p>0 ETH</p>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-md bg-[#4C4EDD]/50 p-6">
          <p className="font-bold">Transactions</p>
          <table className="table-auto text-3xl mt-6">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tx</th>
                <th>TotalAmount</th>
                <th>Saved Amount</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    );
  }

  const page = pages[pageNum];
  const { title, subtitle, text, btn, img, btnAction, beforeBtn, skip } = page!;

  const goNextPage = async () => {
    // Run custom action for the button
    if (btnAction) {
      await btnAction();
    }

    setPageNum(pageNum + 1);
  };

  return (
    <div className="p-24 bg-[url('/background.png')] bg-cover">
      <div className="flex flex-row justify-between">
        <div className="w-3/5">
          <p className="text-7xl text-black mt-48">{title}</p>
          <p className="text-7xl text-[#0002A1] mt-2">{subtitle}</p>
          {text}
          <div className="px-4">
            {beforeBtn}
            <button
              className="w-full p-12 rounded-sm mt-24 bg-slate-200 hover:bg-slate-400 text-black text-4xl"
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={goNextPage}
            >
              {btn}
            </button>

            {skip && (
              <button
                className="w-full p-12 rounded-sm mt-4 bg-white hover:bg-slate-400 text-black text-4xl"
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={() => setPageNum(pageNum + 1)}
              >
                Skip &gt;
              </button>
            )}
          </div>
        </div>
        <div className="w-2/5">
          <img src={img} />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div>
        <h1 className="text-xl font-bold underline">Hello world!</h1>
      </div>
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
            <DividerTitle>Options</DividerTitle>
            <Toggle
              title="Use Paymaster"
              defaultChecked={snapState.usePaymaster}
              onToggle={handleUsePaymasterToggle}
              enabled={Boolean(state.installedSnap)}
            />
            <DividerTitle>Methods</DividerTitle>
            <Accordion items={accountManagementMethods} />
            <Divider />
            <DividerTitle>Snap Configuration</DividerTitle>
            <ChainConfigComponent />
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
    </div>
  );
};

export default Index;
