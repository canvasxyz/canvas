'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import { SIWESigner } from "@canvas-js/chain-ethereum";
import { topic } from '../../contract.canvas.mjs';

interface User {
  signer: SIWESigner;
  id: string;
}

export default function Home() {
  const provider = useMemo(() => {
    return new BrowserProvider(window.ethereum);
  }, []);

  const burnerWallet = useMemo(() => {
    return new SIWESigner({ chainId: 1 });
  }, []);

  const [mmUser, setMMUser] = useState<User>();

  useEffect(() => {
    if (window.ethereum) {

      console.log('running eth stuff :>> ');

      window.ethereum.request({ method: 'eth_accounts' })
        .then(async (accounts: any) => {
          if (accounts.length > 0) {
            console.log('accounts.length :>> ', accounts.length);
            console.log('Connected account:', accounts[0]);

            const ethSigner = await provider.getSigner();
            const network = await provider.getNetwork();

            const canvasSigner = new SIWESigner({ signer: ethSigner, chainId: Number(network.chainId) })

            setMMUser({ signer: canvasSigner, id: ethSigner.address });
          } else {
            console.log('No accounts connected');
            setMMUser(undefined);
          }
        });

      window.ethereum.on("accountsChanged", (accounts: any) => {
        console.log('accounts :>> ', accounts);

        if (accounts.length === 0) {
          setMMUser(undefined);
        }
      });
    }
  }, []);

  const connectEth = async () => {
    try {
      // This call actually prompts the user to connect via metamask,
      // *only* during the first activation, when accounts :>> []
      // If this call does not throw an exception, we can assume 
      // `ethSigner` has a value
      const ethSigner = await provider.getSigner();
      const network = await provider.getNetwork();

      const canvasSigner = new SIWESigner({ signer: ethSigner, chainId: Number(network.chainId) });

      setMMUser({ signer: canvasSigner, id: ethSigner.address });
    } catch (err) {
      console.log('err :>> ', err);
    }
  }

  return (
    <div className="w-[600px] p-4 flex flex-col h-screen">
      <section className="login-section flex-none pb-2">
        {mmUser && (
          <div>
            <span>[Metamask] Signed in as: </span>
            <span className="text-teal-500">{mmUser.id.slice(0, 10)}...</span>
          </div>
        )}

        {!mmUser && (
          <div className="flex justify-between align-middle">
            <div>
              <span>Not signed in, using: </span>
              <span className="text-teal-500">{burnerWallet.key}</span>
              {/* <span className="text-teal-500">burner</span> */}
            </div>
            <div>
              <button onClick={connectEth} className="btn bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm">
                Connect Metamask
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="chat-section border border-gray-300 flex-grow overflow-auto flex flex-col">
        <div className="chat-messages">

        </div>
        <div className="chat-input">

        </div>
      </section>
    </div>
  );
}
