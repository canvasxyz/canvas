import { SIWESigner } from '@canvas-js/chain-ethereum';
import { useCanvas } from '@canvas-js/hooks';
import React, { createContext, ReactNode, useEffect, useState } from 'react';

import { contract } from '../contract';
import { VIEWS } from '../types/views';
import { fromCAIP } from '../utils/converters';
import { ethers } from 'ethers';

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
  setSignerAddress: (value: string | undefined) => void;

  /* Represents the current active route the user is on */
  view: VIEWS;
  setView: (value: VIEWS) => void;
}

export const ChatContext = createContext<ChatContextType>({
  app: null,
  contract: null,
  signer: new SIWESigner({ signer: ethers.Wallet.createRandom() }),
  setSigner: () => null,
  signerAddress: '',
  setSignerAddress: () => null,
  view: VIEWS.Login,
  setView: () => null,
});

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
    console.log('signer updating--');

    signer.getSession(contract.topic).then(signerSession => {
      // setSignerAddress(fromCAIP(signerSession.address));
      console.log('signer updating-- new address: ', signerSession.address);
    });
  }, [signer]);

  // The value that will be supplied to any descendants of this provider
  const value: ChatContextType = { 
    app: app.app,
    contract,
    signer, 
    setSigner,
    signerAddress,
    setSignerAddress,
    view,
    setView };

  console.log('provider address = ', signerAddress)

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};