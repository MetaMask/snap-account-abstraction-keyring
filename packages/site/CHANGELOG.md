# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0]
### Uncategorized
- feat: add scopes field to KeyringAccount ([#166](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/166))

## [0.4.2]
### Changed
- Bump `@metamask/keyring-api` from `^8.0.2` to `^8.1.3` ([#141](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/141))
  - This version is now built slightly differently and is part of the [accounts monorepo](https://github.com/MetaMask/accounts).

## [0.4.1]
### Changed
- Added default params value for walletInvokeSnap ([#126](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/126))

## [0.4.0]
### Changed
- Better user feedback if selected chain ID is not correct ([#120](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/120))
  - It now displays a red border in case of error

### Fixed
- Fixed issues with test IDs, context usage and state ([#120](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/120))

## [0.3.0]
### Added
- Deployment of verifying paymaster from frontend ([#71](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/71))

## [0.2.2]
### Changed
- Bump keyring-api in site package to (latest) 3.0.0 ([#47](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/47))
- Update snap origin ([#44](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/44))

## [0.2.1]

## [0.2.0]
### Changed
- Fix updates configs to match template ([#14](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/14))
- Fix chain config for the companion dapp ([#8](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/8))

## [0.1.0] - 2024-01-15
### Added
- Initial release.

[Unreleased]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/releases/tag/v0.1.0
