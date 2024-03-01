import { ethers, BrowserProvider } from "ethers";
import { useChat } from "../hooks/useChat";
import { VIEWS, useView } from "../hooks/useView";
import { useState } from "react"
import { SIWESigner } from "@canvas-js/chain-ethereum";

export const LoginMetamask: React.FC = () => {
  const { setWallet, topic } = useChat();
  const { setView } = useView();
  const [ MMWallet, setMMWallet ] = useState<ethers.Wallet | null>(null);
  const [ MMError, setMMError] = useState<string | null>();

  // window.ethereum.on("chainChanged", (chainId) => console.log('window.ethereum: chainChanged'));
  // window.ethereum.on("accountsChanged", (accounts) => console.log('window.ethereum: accountsChanged'));

  const launchMetamask = async () => {
    if (!window.ethereum) {
      setMMError('No window.ethereum found. You may need to install Metamask');
    }

    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    const signer = await provider.getSigner();

    debugger

    console.log('signer :>> ', signer);
    const siweSigner = new SIWESigner({ signer, chainId: Number(network.chainId) })
    const { address } = await siweSigner.getSession(topic);
  }

  const loginWithMetamask = () => {
    // setWallet();
    setView(VIEWS.Dashboard);
  }

  return (
    <div>
      <button className="bg-gray-400 hover:bg-gray-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={launchMetamask}>
        Launch Metamask
      </button>

      { MMError && 
        <div className="text-red-500 italic mt-4">Error: {MMError}</div>
      }
    </div>
  )
};
