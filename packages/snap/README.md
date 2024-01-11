# Account Abstraction Keyring Snap

This repository contains an account abstraction example of a keyring snap.

Keyring snaps enable developers to enhance MetaMask by adding new account
types. These accounts are natively supported within the extension, appearing in
MetaMask's UI, and can be used with dapps.

MetaMask Snaps is a system that allows anyone to safely expand the capabilities
of MetaMask. A _snap_ is a program that we run in an isolated environment that
can customize the wallet experience.

# Running Locally

1. `yarn install` to install the dependencies
2. `yarn compile` to build the types for the contracts.
3. `yarn serve` to create a local instance of the snap.
