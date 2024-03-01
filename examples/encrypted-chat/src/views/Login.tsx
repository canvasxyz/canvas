import { ethers } from "ethers";
import { useState } from "react";
import { LoginOptions, LoginSelect } from "../components/Select-Login";

interface LoginFormProps {
  selected: any,
  wallet: ethers.HDNodeWallet,
  setWallet: Function,
};

const LoginForm: React.FC<LoginFormProps> = ({ selected, wallet, setWallet }) => {
  const generateBurnerWallet = () => {
    setWallet(ethers.Wallet.createRandom())
  }

  const loginWithBurner = () => {

  }

  if (selected.id === 'burner') {
    return (
      <div>
        <button className="bg-gray-400 hover:bg-gray-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={generateBurnerWallet}>
          Generate wallet
        </button>

        { wallet && 
          <>
            <div className="text-xs mt-4">
              <div>Private key: &lt;hidden&gt;</div>
              <div>Public key: ${wallet.publicKey}</div>
            </div>
            <button className="bg-blue-400 hover:bg-blue-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={loginWithBurner}>
              Login with {wallet.publicKey.slice(0, 10)}...
            </button>
          </>
        }
      </div>
    )
  }

  if (selected.id === 'ethereum') {
    return (
      <h3>Ethereum login form</h3>
    )
  }

  return null;
};

export const LoginView: React.FC = () => {
  const [selected, setSelected] = useState(LoginOptions[0])
  const [wallet, setWallet] = useState(null);

  return (
    <>
      <LoginSelect selected={selected} setSelected={setSelected} />
      <LoginForm wallet={wallet} setWallet={setWallet} selected={selected} />
    </>
  )
};
