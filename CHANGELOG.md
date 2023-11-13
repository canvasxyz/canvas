# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.1] - 2023-11-11

- Add new signers
- Update signer internals
- Update libp2p to address some WebRTC peering issues

New packages:

- @canvas-js/chain-cosmos
- @canvas-js/chain-atp
- @canvas-js/chain-solana
- @canvas-js/chain-substrate


## [0.5.0] - 2023-10-27

### Changed

- Rewrite the entire framework! 🎉
- Add causal graph structure to the action log
- Separate ModelDB and GossipLog into standalone packages
- New basic data structures using the IPLD data model
- New `SessionSigner` interface
- Use WebRTC for direct browser-to-browser peering
- Support `db.get` inside contracts via history indexing

### Added

New packages:

- `@canvas-js/signed-cid`
- `@canvas-js/modeldb`
- `@canvas-js/gossiplog`
- `@canvas-js/discovery`
- `@canvas-js/templates`
- `@canvas-js/vm`

[unreleased]: https://github.com/canvasxyz/canvas/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/canvasxyz/canvas/compare/v0.5.0
[0.6.1]: https://github.com/canvasxyz/canvas/compare/v0.6.1
