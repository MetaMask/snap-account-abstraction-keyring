# Locker HODL

Locker HODL is a fork of Coinbase Smart Wallet that automatically saves and locks-up a little for you every time you use it.

As an unofficial fork, this wallet cannot be natively imported into wallet.coinbase.com.
To get around this limitation, Locker HODL is packaged into a Metamask snap.
Now you can use your Coinbase Smart Wallet from Metamask too.

Getting native tokens onto new wallets can be a pain.
Locker HODL pays gas for you and bills your card via Stripe.

## Where to find it

- Base Sepolia
  - implementation: [0x3a7B8aC9d9565EB9D32De95356e113190F857aB4](https://basescan.org/address/0x3a7B8aC9d9565EB9D32De95356e113190F857aB4)
  - factory: [0x86FC046543717A67b03847BEDE9560FB4368d274](https://basescan.org/address/0x86FC046543717A67b03847BEDE9560FB4368d274)

## Why you should care

- The problem
- Context about Auto HODL and Locker.

## How to use it

TODO: Video link

1. Install this version of Flask (Metamask)
2. Go to website

## How it's made

- Metamask Snap account abstraction template
- Added foundry and copied in Coinbase Smart Wallet
- Modify Coinbase Smart Wallet code for saving features
  - internal treasury that you can't spend beyond
  - time-lock

TODO: architecture diagram

## Challenges

## Local development

### Deploy contracts

1. Go to contract code: `cd packages/snap`
1. Setup cast account: `cast wallet import hack2  --private-key PRIVATE_KEY_WITHOUT_0x`
1. Setup env vars: `cp .env.sample .env`
1. Deploy CoinbaseSmartWalletFactory: `make deploy`
1. Copy deployment addresses for later

### Setup snap

There is an issue querying the address for a new account from the factory.
You must hardcode the new account address in the snap code.
To do this, interact with the factory you deployed, to get an address

```
cast call FACTORY_ADDRESS --rpc-url RPC_URL  --account CAST_ACCOUNT_NAME "getAddress(bytes[],uint256)" "[0xABI_ENCODED_OWNER]" 0x73c31044ac380f9d678c3a66715e07128c84b728ad7ac39c7c176b80e5fabaf9
```

0x73.. is an arbitrary salt

## Credit

Designs made by [@iiankitadixit](https://x.com/iiankitadixit)
