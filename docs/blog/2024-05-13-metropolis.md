# Metropolis: A new consensus-building tool for Filecoin

_May 13, 2024_

We’ve been working with the Filecoin Foundation on [Metropolis](https://metropolis.vote), a consensus-building tool that will support governance of Filecoin, a decentralized data storage network designed to preserve humanity’s most important information.

Metropolis brings together several key functions that happen during the pre-voting process in Filecoin governance:

* Automatically retrieves Filecoin Improvement Proposals (FIPs) from Github
* Supports nonbinding, positive/negative **sentiment checks** where community members can signal their opinion on different FIPs
* Allows community members to create **open-ended polls** where anyone can contribute comments, and others can signal agreement/disagreement on each others’ comments
* Supports limited commenting - longer and technical comments will remain on Github

This launch is part of Filecoin’s push towards the FIP0001v2 governance redesign, which is rolling out in phases over the course of the year.

Participation on Metropolis is open to anyone with a Github account. In the longer term, we’ll explore different options for authentication, including decentralized identifiers that the community decides to adopt.

Metropolis is an open-source (AGPL) fork of [Polis](https://pol.is), an academically-validated “collective-response survey”, where community members can contribute responses to a prompt, which are routed to other audience members in realtime, who can vote agree/disagree.

Through our work customizing Metropolis with the Filecoin Foundation, we implemented a fork of Polis with small-world community features, like Github login, the ability to view polls alongside Github PRs and issues, and a redesign of the interface.

The next few months will be a proof-of-concept testing period for Metropolis, where we refine the tool along with the community. We’ll also be exploring ways to use signed data and sync technology to allow Metropolis to interoperate with other clients for analyzing the data that’s produced.

If you’re a member of the Filecoin community, or you’re interested in advancing the frontiers of deliberative and democratic governance, we’d love for you to participate and to hear from you!

_Comments and discussion about Metropolis can be found on Filecoin Slack and [Metropolis GitHub](https://github.com/canvasxyz/metropolis). You can also follow [Filecoin Governance](https://x.com/filgov) and [Canvas](https://x.com/canvas_xyz) on X._
