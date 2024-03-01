import { ethers } from "ethers";
import { useChat } from "../hooks/useChat";
import { VIEWS, useView } from "../hooks/useView";
import { useState } from "react"

export const LoginMetamask: React.FC = () => {
  const { setWallet } = useChat();
  const { setView } = useView();
  const [ MMWallet, setMMWallet ] = useState<ethers.Wallet | null>(null);

  const launchMetamask = () => {

  }

  const loginWithMetamask = () => {
    setWallet(MMWallet);
    setView(VIEWS.Dashboard);
  }

  return (
    <div>
      <button className="bg-gray-400 hover:bg-gray-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={launchMetamask}>
        Launch Metamask
      </button>
    </div>
  )
};
