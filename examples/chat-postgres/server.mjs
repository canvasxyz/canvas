// const express = require('express');
// const next = require('next');
import express from "express";
import next from "next";

import { topic, models, actions } from './contract.canvas.mjs';
import { Canvas, defaultBootstrapList } from '@canvas-js/core';
import { SIWESigner, Secp256k1DelegateSigner } from "@canvas-js/chain-ethereum";

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(async () => {
  const canvasApp = await Canvas.initialize({
    path: 'postgresql://postgres:postgres@localhost:5432/chat_postgres',
    contract: {
      topic,
      models,
      actions
    },
    signers: [new Secp256k1DelegateSigner(), new SIWESigner()],
    indexHistory: false,
    discoveryTopic: "canvas-discovery",
    trackAllPeers: true,
    presenceTimeout: 12 * 60 * 60 * 1000, // keep up to 12 hours of offline peers
    bootstrapList: [
      "/dns4/canvas-chat-discovery-staging-p0.fly.dev/tcp/443/wss/p2p/12D3KooWFtS485QGEZwquMQbq7MZTMxiuHs6xUKEi664i4yWUhWa",
      "/dns4/canvas-chat-discovery-staging-p1.fly.dev/tcp/443/wss/p2p/12D3KooWPix1mT8QavTjfiha3hWy85dQDgPb9VWaxRhY8Yq3cC7L",
      "/dns4/canvas-chat-discovery-staging-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRbxAWmpvc9U7q1ftBTd3bKa1iQ2rn6RkwRb1d9K7hVg5",
      "/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q",
      "/dns4/canvas-chat-2.fly.dev/tcp/443/wss/p2p/12D3KooWKGP8AqaPALAqjUf9Bs7KtKtkwDavZBjWhaPqKnisQL7M",
      "/dns4/canvas-chat-3.fly.dev/tcp/443/wss/p2p/12D3KooWAC1vj6ZGhbW8jgsDCZDK3y2sSJG2QGVZEqhEK7Rza8ic",
      ...defaultBootstrapList,
    ],
  });

  canvasApp.libp2p.start();

  // Creating an action object 
  // Just make an object with the type 'Action'
  // There are helpers for this
  // Creating a signer

  // Send both "action"
  // You wanna use insert

  // (Use vscode and click through app.actions)

  const expressApp = express();
  expressApp.use(express.json());
  expressApp.set('json spaces', 2);

  expressApp.get("/read", async (_, res) => {
    console.log('canvasApp.status :>> ', canvasApp.status);

    try {
      const results = await canvasApp.db.query("message", {})
      const connections = canvasApp.libp2p.getConnections();

      return res.json({
        messages: results,
        status: canvasApp.status,
        connectionsLength: connections.length,
        connections,
      });
    } catch (err) {
      return res.status(400).json({ error: '[Canvas] query failed' });
    }
  });

  expressApp.post("/send", async (req, res) => {
    console.log('req.body :>> ', req.body);

    const messageContent = req.body.message || 'Default message';

    try {
      await canvasApp.actions.createMessage({ content: messageContent });

      res.json({ message: messageContent });
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  expressApp.get("/getClock", async (_, res) => {
    try {
      const [nextClockValue, parentMessageIds] = await canvasApp.messageLog.getClock();

      res.json({ nextClockValue, parentMessageIds });
    } catch (error) {
      console.error('Error fetching clock values:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  expressApp.post("/insert", async (req, res) => {
    const signature = {
      ...req.body.signature,
      signature: new Uint8Array(req.body.signature.signature)
    };
    const message = req.body.message;

    if (!signature || !message) {
      console.log('~~ message didnt come through ~~');
    }

    canvasApp.insert(signature, message);
  });

  expressApp.all('*', (req, res) => {
    return handle(req, res);
  });

  expressApp.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});