import { ethers } from "ethers";
import { useState } from "react";
import { LoginOptions, LoginSelect } from "../components/Select-Login";
import { useChat } from "../hooks/useChat";
import { useView, VIEWS } from "../hooks/useView";

interface LoginFormProps {
  selected: any,
  wallet: ethers.HDNodeWallet,
  setWallet: Function,
};

const LoginForm: React.FC<LoginFormProps> = ({ selected }) => {
  const { setWallet } = useChat();
  const { setView } = useView();
  const [ burnerWallet, setBurnerWallet ] = useState<ethers.Wallet | null>(null);

  const generateBurnerWallet = () => {
    setBurnerWallet(new ethers.Wallet(ethers.Wallet.createRandom().privateKey));
  }

  const loginWithBurner = () => {
    setWallet(burnerWallet);
    setView(VIEWS.Dashboard);
  }

  if (selected.id === 'burner') {
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
              Login with {burnerWallet?.publicKey.slice(0, 10)}...
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
  // const [wallet, setWallet] = useState(null);

  const { wallet, setWallet } = useChat();

  return (
    <>
      <LoginSelect selected={selected} setSelected={setSelected} />
      <LoginForm wallet={wallet} setWallet={setWallet} selected={selected} />
    </>
  )
};
