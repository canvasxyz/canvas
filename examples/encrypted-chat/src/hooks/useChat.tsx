import { SIWESigner } from "@canvas-js/chain-ethereum";
import type { Contract } from "@canvas-js/core"
import { useCanvas } from "@canvas-js/hooks";
import { ethers } from "ethers";
import { useState } from "react";

const APP_TOPIC = '96f42ea6-f170-4630-a827-77ec31d24f85';
const DISCOVERY_TOPIC = 'canvas-discovery';

export const useChat = () => {

  const [wallet, setWallet] = useState(null);

  const contract = {
    topic: APP_TOPIC,
    models: {
      message: {
        id: "primary",
        address: "string",
        content: "string",
        timestamp: "integer",
        $indexes: ["address", "timestamp"],
      },
    },
    actions: {
      async createMessage(db: any, { content }: {content: any}, { id, address, timestamp } : {id: any, address: any, timestamp: any}) {
        console.log("received message:", content)
        await db.set("message", { id, address, content, timestamp })
      },
    },
  } satisfies Contract

  const dummySignerKey = ethers.Wallet.createRandom().privateKey;
  const dummySignerWallet = new ethers.Wallet(dummySignerKey);

  const { app } = useCanvas({
    contract, 
    signers: [new SIWESigner({ signer: dummySignerWallet })],
  });

  return { app, wallet, setWallet };
}