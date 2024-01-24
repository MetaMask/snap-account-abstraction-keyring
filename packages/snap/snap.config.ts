import type { SnapConfig } from '@metamask/snaps-cli';

const config: SnapConfig = {
  bundler: 'webpack',
  input: 'src/index.ts',
  server: { port: 8080 },
  polyfills: {
    buffer: true,
    stream: true,
    crypto: true,
  },
  environment: {
    DAPP_ORIGIN_PRODUCTION:
      'https://metamask.github.io/snap-account-abstraction-keyring/',
    DAPP_ORIGIN_DEVELOPMENT: 'http://localhost:8000/',
    BUNDLER_URL: 'MOCK_URL',
    VERIFYING_PAYMASTER_ADDRESS: '0xf5E2A7441a3f00E81627ec94f25E572bf4968301',
  },
  stats: {
    builtIns: {
      // The following builtins can be ignored. They are used by some of the
      // dependencies, but are not required by this snap.
      ignore: [
        'events',
        'http',
        'https',
        'zlib',
        'util',
        'url',
        'string_decoder',
        'punycode',
      ],
    },
  },
};

export default config;
