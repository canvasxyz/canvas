import { ethers } from "ethers";
import { useContext, useState } from "react"
import { VIEWS } from "../types/views";
import { SIWESigner } from "@canvas-js/chain-ethereum";
import { ChatContext } from "../contexts/chatProvider";

export const LoginBurner: React.FC = () => {
  const { setSigner, setView, setSignerAddress } = useContext(ChatContext);

  const [ burnerWallet, setBurnerWallet ] = useState<ethers.HDNodeWallet | undefined>();

  const generateBurnerWallet = () => {
    setBurnerWallet(ethers.Wallet.createRandom());
  }

  const loginWithBurner = () => {
    const getSigner = async () => {
      const signer = new SIWESigner({ signer: burnerWallet });

      setSigner(signer);
      setSignerAddress(burnerWallet?.address);
      setView(VIEWS.Dashboard);
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
            <div>Public key: {burnerWallet?.publicKey.slice(0, 20)}...</div>
            <div>Address: {burnerWallet?.address.slice(0, 20)}...</div>
          </div>
          <button className="bg-blue-400 hover:bg-blue-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={loginWithBurner}>
            Login with {burnerWallet?.address?.slice(0, 10)}...
          </button>
        </>
      }
    </div>
  )
};
