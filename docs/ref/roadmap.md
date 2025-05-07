# Roadmap & Changelog

_This page lists the upcoming priorities that we're working on right now.
For past release notes, please see [Github](https://github.com/canvasxyz/canvas/releases)._

## Immediate priorities

- Improving the experience around upgrading applications.
- Improving the experience for hosting applications.
- Working on several applications built on our system to
  create a better developer experience.

## Long-term priorities

- Adding a non-Ethereum, conventional (web2-friendly) login method.
- Improving configurability around peer-to-peer networking, for
  e.g. applications that want to only sync with selected peers
  rather than connecting to the DHT.
- Support for application deployment on existing EVM chains.
- Support for sharding applications into multiple objects.
- Support for partial sync.
- Support for private data.

## 0.15 (Next release)

**Model-only contracts**

- Adds an API for defining application contracts/databases without
  actions. Instead, you will be able to provide a $rules array, similar
  to permissions in Firebase.
- Adds db.create() method for creating new objects with randomized primary keys
  while using model-only contracts.
- Adds db.merge(), db.update() methods for partial updates. These are only
  available inside transactions at this time.
- Adds a class syntax for contracts, that greatly simplifies how contracts
  are defined.

## 0.14 (2025-04-18)

This releases includes significant changes to the main application API,
around how actions are defined.

- The core application APIs have now stabilized. We are in the process of documenting them now.
- Adds Farcaster login support, both inside frames, and outside frames using SIWF.
- Adds basic login components, including a sign in/sign out button, provided as a React component.