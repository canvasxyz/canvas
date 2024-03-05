import { ethers } from "ethers";
import { useChat } from "../hooks/useChat";
import { useState } from "react"
import { VIEWS } from "../types/views";
import { SIWESigner } from "@canvas-js/chain-ethereum";
import { contract } from "../contract";

export const LoginBurner: React.FC = () => {
  const { setSigner, setView } = useChat();
  const [ burnerWallet, setBurnerWallet ] = useState<ethers.HDNodeWallet>(ethers.Wallet.createRandom());

  const generateBurnerWallet = () => {
    setBurnerWallet(ethers.Wallet.createRandom());
  }

  const loginWithBurner = () => {
    const getSigner = async () => {
      const signer = new SIWESigner({ signer: burnerWallet });
      const session = await signer.getSession(contract.topic);

      debugger
      setSigner(signer);
      setView(VIEWS.Dashboard);
      console.log('logged in!')
    }

    getSigner();
  }

  return (
    <div>
      <button className="bg-gray-400 hover:bg-gray-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={generateBurnerWallet}>
        Generate wallet
      </button>

      { burnerWallet && 
        <>
          <div className="text-xs mt-4">
            <div>Private key: &lt;hidden&gt;</div>
            <div>Public key: ${burnerWallet?.publicKey}</div>
          </div>
          <button className="bg-blue-400 hover:bg-blue-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={loginWithBurner}>
            Login with {burnerWallet?.publicKey?.slice(0, 10)}...
          </button>
        </>
      }
    </div>
  )
};
