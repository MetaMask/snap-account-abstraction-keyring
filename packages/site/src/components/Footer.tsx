import React from 'react';
import styled, { useTheme } from 'styled-components';

import { MetaMask } from './MetaMask';
import { PoweredBy } from './PoweredBy';
import { ReactComponent as Coinbase } from '../assets/coinbase.svg';
import { ReactComponent as Stripe } from '../assets/stripe.svg';

const FooterWrapper = styled.footer`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding-top: 2.4rem;
  padding-bottom: 2.4rem;
  border-top: 1px solid ${(props) => props.theme.colors.border?.default};
`;

const PoweredByButton = styled.a`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 1.2rem;
  border-radius: ${({ theme }) => theme.radii.button};
  box-shadow: ${({ theme }) => theme.shadows.button};
  background-color: ${({ theme }) => theme.colors.background?.alternative};
`;

const PoweredByContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-left: 1rem;
`;

export const Footer = () => {
  const theme = useTheme();

  return (
    <FooterWrapper>
      <PoweredByButton href="https://docs.metamask.io/" target="_blank">
        <Coinbase />
        <PoweredByContainer>
          <PoweredBy color={theme.colors.text?.muted ?? '#6A737D'} />
          <span>Coinbase</span>
        </PoweredByContainer>
      </PoweredByButton>
      <div className="mx-4"></div>
      <PoweredByButton href="https://docs.metamask.io/" target="_blank">
        <Stripe />
        <PoweredByContainer>
          <PoweredBy color={theme.colors.text?.muted ?? '#6A737D'} />
          <span>Stripe</span>
        </PoweredByContainer>
      </PoweredByButton>
    </FooterWrapper>
  );
};
