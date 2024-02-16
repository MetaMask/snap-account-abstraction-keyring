# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1]
### Uncategorized
- Revert "0.2.1 (#33)" ([#33](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/33))
- 0.2.1 ([#33](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/33))
- fix: autochangelog ([#30](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/30))
- Revert "0.2.1 (#28)" ([#28](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/28))
- 0.2.1 ([#28](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/28))
- chore: bump keyring-api dep ([#26](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/26))
- 0.2.0 ([#24](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/24))
- chore: add changelog category ([#23](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/23))
- fix: downgrade version to retrigger publish ([#21](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/21))
- 0.2.0 ([#19](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/19))
- Use snap template workflows ([#17](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/17))
- Fix updates configs to match template ([#14](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/14))
- fix: changelogs
- fix: lint in template string
- fix: remove unneeded deps
- fix: lint
- fix: lint
- fix: remove prettier for cache, coverage and artifacts
- chore: fix lint
- fix: dynamically set networks based on env
- fix: remove @uniswap/sdk-core
- fix: update env files for snap
- fix: lint
- fix: verifying paymaster test
- fix: tests
- Removed userOp methods from front-end
- Added validation to setting the config
- Updated TODOs for validation and setting if an account is deployed
- Fix: do not destructure transaction array in prepareUserOp
- Fix: return '0x' for dummy paymaster and data
- Fix: updated chainIdDecimal to base 10
- Fix: wrap user op hash in bytes before signing
- Added ability to set chain configuration via keyring and UI
- Added salt ability to front end create account
- fix: remove usage of jest env
- Added compile step to build
- fix: patchUserOperation to use verifying paymaster
- chore: update readme
- fix: sign userOperation
- feat: update hardhat config with chainId and max accounts
- updated front end to import private key in create account and include userOp methods
- fix: change salt to be dynamic
- fix: update keyring api on site
- fix: SimpleAccountFactory getAddress to getAccountAddress
- fix: return types for prepareUserOperation
- fix: add network-access permission
- feat: impl patchUserOperation
- Added salt to wallet state and address for paymaster to env.sample
- Updated paymaster url in env.sample
- Updated dummy values and added urls to env.sample
- Updated implementation for preparing and signing requests and merged with deploy contracts branch
- Merge remote-tracking branch 'origin/feat/deploy-factories' into feat/implement-4337-methods
- Finished implementing prepareUserOp
- feat: add deployment script for factories
- feat: add env sample and update hardhat config
- feat: add jest
- Started implementing method to prepare userOp
- Added method stubs for user operations
- Init: removed async methods and flows
- Removed unnecessary error throw and set deployed to false in createAccount
- Added initCode generation to createAccount
- Added sign transaction to unsupported methods
- Added ethers@5.7.0 to dependencies
- feat: init commit with createAccount and state updates
- feat: update readme and gitignore
- feat: add v0.6.0 reference contracts
- feat: add hardhat and openzeppelin
- feat: inital aa snap commit

## [0.2.0]
### Added
- Add userop methods and updates account creation ([#4](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/4))
- Add contract addresses and deployment script ([#2](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/2))

### Changed
- Fix regex to support query parameters ([#13](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/13))
- Fix initcode generation ([#8](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/8))

## [0.1.0] - 2024-01-15
### Added
- Initial release.

[Unreleased]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/releases/tag/v0.1.0
