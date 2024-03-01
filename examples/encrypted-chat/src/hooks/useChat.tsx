import { SIWESigner } from "@canvas-js/chain-ethereum";
import { useCanvas } from "@canvas-js/hooks";
import { ethers } from "ethers";
import { useMemo, useState } from "react";

import { contract } from '../contract';

export const useChat = () => {
  const [wallet, setWallet] = useState<ethers.HDNodeWallet | null>(null);

  const signers = useMemo(() => {
    if (wallet) {
      return [new SIWESigner({signer: wallet})];
    }

    return [];
  }, [wallet]);

  const app = useCanvas({
    contract, 
    signers: signers,
  });

  return { app, topic: contract.topic, wallet, setWallet };
}