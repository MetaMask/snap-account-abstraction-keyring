# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0]
### Fixed
- Returns `null` if `handleKeyringRequest` returns `undefined`/`void` ([#180](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/180))

### Changed
- Bump `ethers@^5.8.0` ([#179](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/179))

## [0.5.0]
### Changed
- **BREAKING:** Provide `scopes` field to `KeyringAccount` during account creation ([#166](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/166))
  - Bump `@metamask/keyring-api` from `^8.1.3` to `^13.0.0`.
  - Compatible with `@metamask/eth-snap-keyring@^7.1.0`.

## [0.4.2]
### Changed
- Bump `@metamask/keyring-api` from `^8.0.2` to `^8.1.3` ([#141](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/141))
  - This version is now built slightly differently and is part of the [accounts monorepo](https://github.com/MetaMask/accounts).

## [0.4.1]

## [0.4.0]
### Added
- Add localhost chain ID to chain config ([#120](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/120))

## [0.3.0]
### Changed
- Bump dependencies `@metamask/keyring-api` to `^6.0.0`, `@metamask/snaps-sdk` to `^4.0.1` and other minor versions of @etherumjs and @metamask dependencies([#86](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/86))
- Fix chain config setup ([#62](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/62))
- Fix undefined param for chain config ([#81](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/81))
- Remove pending requests and associated methods ([#45](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/45))

## [0.2.2]
### Changed
- Update chain config validation logic ([#20](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/20))
- Bump @metamask/snaps-sdk from 2.0.0 to 2.1.0 ([#37](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/37))

## [0.2.1]
### Changed
- Bump keyring-api dependency ([#26](https://github.com/MetaMask/snap-account-abstraction-keyring/pull/26))

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

[Unreleased]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.5.0...v1.0.0
[0.5.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MetaMask/snap-account-abstraction-keyring/releases/tag/v0.1.0
