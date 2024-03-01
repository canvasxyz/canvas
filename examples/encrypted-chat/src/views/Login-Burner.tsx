import { ethers } from "ethers";
import { useChat } from "../hooks/useChat";
import { VIEWS, useView } from "../hooks/useView";
import { useState } from "react"

export const LoginBurner: React.FC = () => {
  const { setWallet } = useChat();
  const { setView } = useView();
  const [ burnerWallet, setBurnerWallet ] = useState<ethers.HDNodeWallet | null>(null);

  const generateBurnerWallet = () => {
    setBurnerWallet(ethers.Wallet.createRandom());
  }

  const loginWithBurner = () => {
    setWallet(burnerWallet);
    setView(VIEWS.Dashboard);

    console.log('logged in!')
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
