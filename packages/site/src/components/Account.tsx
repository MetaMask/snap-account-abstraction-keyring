import { type KeyringAccount } from '@metamask/keyring-api';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import React, { useState } from 'react';

import { MethodButton } from './Buttons';
import { CopyableItem } from './CopyableItem';
import {
  AccountContainer,
  AccountTitleContainer,
  AccountTitle,
  AccountTitleIconContainer,
  AccountRow,
  AccountRowTitle,
  AccountRowValue,
  StyledIcon,
} from './styledComponents';

export const Account = ({
  account,
  handleDelete,
  count,
  currentAccount
}: {
    currentAccount: string;
    account: KeyringAccount;
    handleDelete: (accountId: string) => Promise<void>;
    count: number;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <AccountContainer>
      <AccountTitleContainer onClick={() => setIsCollapsed(!isCollapsed)}>
        <AccountTitle>
          Account {count + 1}
          {currentAccount.toLowerCase() === account.address.toLowerCase() && <StyledIcon><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg></StyledIcon>}


        </AccountTitle>
        <AccountTitleIconContainer>
          {isCollapsed ? (
            <ExpandMoreIcon
              fontSize="large"
            />
          ) : (
            <ExpandLessIcon
                fontSize="large"
            />
          )}
        </AccountTitleIconContainer>
      </AccountTitleContainer>
      {!isCollapsed && (
        <>
          {/* <AccountRow>
            <AccountRowTitle>ID</AccountRowTitle>
            <CopyableItem value={account.id} />
          </AccountRow> */}
          <AccountRow>
            <AccountRowTitle>Address</AccountRowTitle>
            <CopyableItem value={account.address} />
          </AccountRow>
          <AccountRow>
            <AccountRowTitle>Type</AccountRowTitle>
            <AccountRowValue>{account.type}</AccountRowValue>
          </AccountRow>
          {/* <AccountRow>
            <AccountRowTitle>Account Supported Methods</AccountRowTitle>
            <ul style={{ padding: '0px 0px 0px 16px' }}>
              {account.methods.map((method) => (
                <AccountRowValue key={`account-${account.id}-method-${method}`}>
                  <li>{method}</li>
                </AccountRowValue>
              ))}
            </ul>
          </AccountRow> */}
          {currentAccount.toLowerCase() === account.address.toLowerCase() ? <></> :
            <AccountRow alignItems="flex-end">
              <MethodButton
                width="30%"
                margin="8px 0px 8px 8px"
                onClick={async (): Promise<void> => {
                  await handleDelete(account.id);
                }}
                label="Delete"
              />
            </AccountRow>
          }
        </>
      )}
    </AccountContainer>
  );
};
