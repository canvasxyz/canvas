import { SIWESigner } from "@canvas-js/chain-ethereum";
import { useCanvas } from "@canvas-js/hooks";
import { ethers } from "ethers";
import { useMemo, useState } from "react";

import { contract } from '../contract';

export const useChat = () => {
  const [wallet, setWallet] = useState<ethers.Wallet | null>(null);

  const dummySignerKey = ethers.Wallet.createRandom().privateKey;
  const dummySignerWallet = new ethers.Wallet(dummySignerKey);

  const app = useCanvas({
    contract, 
    signers: [new SIWESigner({ signer: dummySignerWallet })],
  });

  return { app, wallet, setWallet };
}