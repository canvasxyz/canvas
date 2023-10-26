---
layout: home

hero:
  text: "Decentralized applications at the speed of light"
  image: "images/graphic_mainframe_4.png"
  tagline: "Canvas is a compute engine for complex peer-to-peer programs, that sync virtually instantly."
  actions:
    - theme: brand
      text: Read the docs
      link: /1-introduction
    - theme: alt
      text: API Examples
      link: /api-examples
---

<FeatureRow title="Demo">
  <FeatureCard title="MessageSync" details="Deploy simple applications like chat & presence." />
  <FeatureCard title="TypeScript Contracts" details="Write complex application backends in TypeScript, without leaving your existing workflow." />
  <FeatureCard title="IPFS Contracts" details="Make immutable decentralized applications, with code stored on IPFS."/>
</FeatureRow>

<DemoRow>
  <DemoItem title="MessageSync Demo" />
  <DemoItem title="CausalDB Demo" />
</DemoRow>

<TextRow title="About Canvas">
  <TextItem prefix="Fast">Actions are processed as soon as they're seen.</TextItem>
  <TextItem prefix="Optimistic">Actions can arrive out-of-order, but CRDTs and distributed server reconciliation are used to resolve differences.</TextItem>
  <TextItem prefix="Client-first">The entire state of each application is stored inside the browser. Applications can be partitioned so clients only sync data they're interested in.</TextItem>
  <TextItem prefix="Server-enabled">We provide a CLI for running Canvas applications on the server, and are working on a hosting service.</TextItem>
  <TextItem prefix="Bring your own finality">The default engine doesn't implement a finality mechanism, but you can add your own with any timestamping or DA layers.</TextItem>
</TextRow>

<FeatureRow title="Logins">
  <FeatureCard title="Sign in with Wallet" details="Log in with a Web3 wallet from Ethereum. Also supports other chains like Cosmos, Solana, and Polkadot." soon="Available today" />
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers. Powered by zero-knowledge proofs." soon="Coming soon"/>
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from Bluesky." soon="Coming soon"/>
</FeatureRow>

<FeatureRow title="Technical Components">
  <FeatureCard title="Okra" details="A deterministic Prolly-tree that allows fast syncing between unordered sets of actions." link="https://github.com/canvasxyz/okra" linkText="Github" />
  <FeatureCard title="GossipLog" details="A history-preserving log that allows CRDT functions to retrieve data from the past." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog"/>
  <FeatureCard title="ModelDB" details="A database abstraction layer over IndexedDB and SQLite, that runs in both the browser and server." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb"/>
</FeatureRow>

<HomepageFooter />