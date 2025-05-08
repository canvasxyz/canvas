# Roadmap & Changelog

<!-- Please do not use line breaks, or inline code blocks, inside markdown-it checkbox lists. -->

_This page lists the upcoming priorities that we're working on right now.
For past release notes, please see [Github](https://github.com/canvasxyz/canvas/releases)._

## Upcoming Priorities

- **Improving the experience around upgrading applications.**
- **Improving the experience for hosting applications.**
- **Supporting the launch of the first protocolized applications on our system.** (by June 2025)
- Adding a non-Ethereum, conventional (web2-friendly) login method.
- Improving configurability around peer-to-peer networking, for
  e.g. applications that want to only sync with selected peers
  rather than connecting to the DHT.
- Support for application deployment on existing EVM chains.
- Support for sharding applications into multiple objects.
- Support for partial sync.
- Support for private data.

## 0.15 (Next release)

This is a nonbreaking, backwards compatible change that adds two new syntaxes for
contracts: class contracts and model-only contracts.

- [ ] Adds an API for defining applications as ES6 classes.
- [x] Adds an API for defining application contracts/databases without actions, where permissions are defined in a $rules object, similar to Firebase.
- [x] Adds db.create() and db.id() methods for creating database records with randomized primary keys.
- [x] Adds db.merge() and db.update() methods for partial updates. These are only available inside transactions at this time.

## 0.14 (2025-04-18)

This releases includes significant changes to the main application API,
around how actions are defined.

- The core application APIs have now stabilized. We are in the process of documenting them now.
- Adds Farcaster login support, both inside frames, and outside frames using SIWF.
- Adds basic login components, including a sign in/sign out button, provided as a React component.