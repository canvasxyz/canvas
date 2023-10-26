---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Canvas"
  text: "An instant-sync engine for decentralized applications"
  tagline: "Extend onchain applications with a peer-to-peer layer where interactions are synced instantly, with nearly unlimited throughput."
  actions:
    - theme: brand
      text: Read the docs
      link: /markdown-examples
    - theme: alt
      text: API Examples
      link: /api-examples
---

<FeatureRow title="Demo">
  <FeatureCard title="MessageSync" details="Deploy simple applications like chat & presence." />
  <FeatureCard title="CausalDB" details="Define custom backend logic in inline TypeScript." />
  <FeatureCard title="CausalVM" details="Define immutable TypeScript contracts on IPFS." />
</FeatureRow>

<DemoRow>
  <DemoItem title="MessageSync Demo" />
  <DemoItem title="CausalDB Demo" />
</DemoRow>

<TextRow title="About Canvas">
  <TextItem prefix="Fast">Actions are processed as soon as they're seen.</TextItem>
  <TextItem prefix="Optimistic">Actions can arrive out-of-order, but CRDTs and distributed server reconciliation are used to resolve differences.</TextItem>
  <TextItem prefix="Client-first">The entire state of each application is stored inside the browser. Applications can be partitioned so clients only sync the data they're interested in.</TextItem>
  <TextItem prefix="Server-enabled">We provide a CLI for running Canvas applications on the server, and are working on a hosting service.</TextItem>
  <TextItem prefix="Encryption-enabled">You can use helpers to generate private keys, encrypt clients' data, and use zk-proving and verification.</TextItem>
  <TextItem prefix="Bring your own finality">The default engine doesn't implement any finality mechanisms, but you can bring your own by adding a timestamping or DA layer.</TextItem>
</TextRow>

<FeatureRow title="Logins">
  <FeatureCard title="Sign in with Wallet" details="Log in with a Web3 wallet from Ethereum. Also supports other chains like Cosmos, Solana, and Polkadot." />
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers. Powered by zero-knowledge proofs." />
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from Bluesky." />
</FeatureRow>

<FeatureRow title="Technical Components">
  <FeatureCard title="Okra" details="A deterministic Prolly-tree that allows fast syncing between unordered sets of actions." link="https://github.com/canvasxyz/okra" linkText="Github" />
  <FeatureCard title="GossipLog" details="A history-preserving log that allows CRDT functions to retrieve data from the past." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog"/>
  <FeatureCard title="ModelDB" details="A database abstraction layer over IndexedDB and SQLite, that runs in both the browser and server." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb"/>
</FeatureRow>

<HomepageFooter />