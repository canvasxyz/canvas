import React, { createContext, useState, ReactNode } from "react";
import { SessionSigner } from "@canvas-js/interfaces";

interface CanvasContextType {
  sessionSigner: SessionSigner | null;
  setSessionSigner: (signer: SessionSigner | null) => void;
  address: string | null;
  setAddress: (address: string | null) => void;
}

export const CanvasContext = createContext<CanvasContextType>({
  sessionSigner: null,
  setSessionSigner: () => {},
  address: null,
  setAddress: () => {},
});

interface CanvasProviderProps {
  children: ReactNode;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  const [sessionSigner, setSessionSigner] = useState<SessionSigner | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  return (
    <CanvasContext.Provider value={{ sessionSigner, setSessionSigner, address, setAddress }}>
      {children}
    </CanvasContext.Provider>
  );
}; 