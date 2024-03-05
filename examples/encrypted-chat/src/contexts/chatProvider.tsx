import { SIWESigner } from '@canvas-js/chain-ethereum';
import { useCanvas } from '@canvas-js/hooks';
import React, { createContext, ReactNode, useEffect, useMemo, useState } from 'react';

import { contract } from '../contract';
import { VIEWS } from '../types/views';
import { fromCAIP } from '../utils/converters';

export interface ChatContextType {
  /* Represents the full Canvas object */
  app: any;

  /* A copy of the contract used during app initialization */
  contract: any;

  /* A valid, authenticated Ethereum signer that represents the currently logged in user.
  Default: ethers.Wallet.random()
  */
  signer: SIWESigner;
  setSigner: (value: SIWESigner) => void;

  /* The ethereum address associated with this user's session.
  Derived from `signer`
  */
  signerAddress: string | undefined;
  setSignerAddress: (value: string) => void;

  /* Represents the current active route the user is on */
  view: VIEWS;
  setView: (value: VIEWS) => void;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [view, setView] = useState<VIEWS>(VIEWS.Login);
  const [signer, setSigner] = useState<SIWESigner>(new SIWESigner());
  const [signerAddress, setSignerAddress] = useState<string | undefined>(undefined);

  const app = useCanvas({
    contract,
    signers: [signer],
  });

  // update signerAddress when signer changes
  useEffect(() => {
    signer.getSession(contract.topic).then(signerSession => {
      setSignerAddress(fromCAIP(signerSession.address));
    });
  }, [signer]);

  // The value that will be supplied to any descendants of this provider
  const value: ChatContextType = { 
    app,
    contract,
    signer, 
    setSigner,
    signerAddress,
    setSignerAddress,
    view,
    setView };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};