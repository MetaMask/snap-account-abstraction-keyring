export const chainIdToName = (chainId: string): string => {
  switch (chainId) {
    case '1':
      return 'Mainnet';
    case '43113':
      return 'Avalanche Fuji Testnet';
    case '44787':
      return 'Celo Alfajores Testnet';
    case '80001':
      return 'Polygon Mumbai';
    case '421614':
      return 'Arbitrum Sepolia';
    case '11155111':
      return 'Sepolia';
    case '11155420':
      return 'Optimism Sepolia';
    case '1337':
      return 'Local RPC';
    case '59140':
      return 'Linea Goerli';
    default:
      return chainId;
  }
};
