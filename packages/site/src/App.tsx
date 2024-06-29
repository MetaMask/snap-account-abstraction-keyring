import type { FunctionComponent, ReactNode } from 'react';
import React from 'react';
import { Helmet } from 'react-helmet';
import styled from 'styled-components';

import { Footer, Header, AlertBanner, AlertType } from './components';
import { GlobalStyle } from './config/theme';

export type AppProps = {
  children: ReactNode;
};

export const App: FunctionComponent<AppProps> = ({ children }) => {
  // Make sure we are on a browser, otherwise we can't use window.ethereum.
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <>
      <Helmet>
        <meta charSet="utf-8" />
        <title>Account Abstraction Snap</title>
      </Helmet>
      <GlobalStyle />
      <div className="bg-[url('/background.png')]">
        {children}
        <Footer />
      </div>
    </>
  );
};
