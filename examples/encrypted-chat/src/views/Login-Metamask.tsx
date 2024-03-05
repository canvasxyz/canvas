import { ethers, BrowserProvider } from "ethers";
import { useChat } from "../hooks/useChat";
import { VIEWS } from "../types/views";
import { useEffect, useState } from "react"
import { SIWESigner } from "@canvas-js/chain-ethereum";

export const LoginMetamask: React.FC = () => {
  const { setSigner, setView } = useChat();
  const [ MMWallet, setMMWallet ] = useState<ethers.Wallet | null>(null);
  const [ MMError, setMMError] = useState<string | null>();

  const [provider, setProvider] = useState<any>(null);
  const [addr, setAddr] = useState<any>(null);

  // register window.ethereum listeners
  useEffect(() => {
    window.ethereum?.on("chainChanged", async (chainId) => {
      console.log('window.ethereum: chainChanged');
      const signer = await provider.getSigner();
  
      // debugger 
    });
    window.ethereum?.on("accountsChanged", async (accounts) => {
      console.log('window.ethereum: accountsChanged');
      const signer = await provider.getSigner();
  
      // debugger
    });
  }, [window.ethereum]);

  // Check if metamask connection has been initiated
  // TODO: `useMetamask` hook should abstract this -- should also abstract listeners too
  useEffect(() => {
    if (window.ethereum) {
      const provider = new BrowserProvider(window.ethereum);

      // const signer = provider.getSigner().then(signer => {
      //   setProvider(provider);
      //   setAddr(signer.address);
      // });
    }
  }, []);

  const disconnectMetamask = async () => {
    const accounts = await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{
            eth_accounts: {}
        }]
    }).then(() => window.ethereum.request({
        method: 'eth_requestAccounts'
    }))

    const account = accounts[0]
  }

  const launchMetamask = async () => {
    if (!window.ethereum) {
      setMMError('No window.ethereum found. You may need to install Metamask');
    }

    const provider = new BrowserProvider(window.ethereum);
    // const accounts = await provider.send('eth_requestAccounts', []);
    const network = await provider.getNetwork();
    const signer = await provider.getSigner();

    // debugger

    setProvider(provider);

    console.log('signer :>> ', signer);
    const siweSigner = new SIWESigner({ signer, chainId: Number(network.chainId) })

    console.log('siweSigner = ', siweSigner)
    // debugger
    
    setSigner(siweSigner);
    // const { address } = await siweSigner.getSession(topic);
  }

  const loginWithMetamask = () => {
    // setWallet();
    setView(VIEWS.Dashboard);
  }

  return (
    <div>
      {addr && 
        <>        
          <div>Active metamask user: {addr}</div>

          <button className="bg-gray-400 hover:bg-gray-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={launchMetamask}>
            Sign in with {addr}
          </button>
        </>
      }

      {!addr && 
        <button className="bg-gray-400 hover:bg-gray-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={launchMetamask}>
          Launch Metamask
        </button>
      }

      {/* <button className="bg-red-400 hover:bg-red-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={disconnectMetamask}>
        Disconnect Metamask
      </button> */}

      { MMError && 
        <div className="text-red-500 italic mt-4">Error: {MMError}</div>
      }
    </div>
  )
};
