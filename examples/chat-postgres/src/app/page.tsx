'use client';

import { useEffect } from "react";
import { BrowserProvider } from "ethers";
import { SIWESigner } from "@canvas-js/chain-ethereum";
import { topic } from '../../contract.canvas.mjs';

export default function Home() {

  useEffect(() => {
    if (window.ethereum) {

      console.log('running eth stuff :>> ');

      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: any) => {
          if (accounts.length > 0) {
            console.log('accounts.length :>> ', accounts.length);
            console.log('Connected account:', accounts[0]);
          } else {
            console.log('No accounts connected');
          }
        });

      window.ethereum.on("chainChanged", (chainId: any) => {
        console.log('chainId :>> ', chainId);
      });
      window.ethereum.on("accountsChanged", (accounts: any) => {
        console.log('accounts :>> ', accounts);
      });
    }
  }, []);

  const connectEth = async () => {
    // window.ethereum.request({ method: 'eth_accounts' })
    //   .then((accounts: any) => {
    //     if (accounts.length > 0) {
    //       console.log('Connected account:', accounts[0]);
    //     } else {
    //       console.log('No accounts connected');
    //     }
    //   });
    const provider = new BrowserProvider(window.ethereum);

    const network = await provider.getNetwork();
    const signer = await provider
      .getSigner()
      .then((signer) => new SIWESigner({ signer, chainId: Number(network.chainId) }));
    const { address } = await signer.getSession(topic);
  }

  return (
    <div>

      <div className="w-[400px] p-8">
        <h1>Hi</h1>

        <button onClick={connectEth} className="btn bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm">
          Connect to Ethereum
        </button>
      </div>

    </div>
  );
}
