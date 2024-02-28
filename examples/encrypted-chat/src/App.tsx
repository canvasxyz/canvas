import React, { useState } from 'react';
import { ethers } from "ethers";
import { LoginSelect, LoginOptions } from './Select-Login';

interface LoginFormProps {
  selected: any,
  wallet: ethers.HDNodeWallet,
  setWallet: Function,
};

const LoginForm: React.FC<LoginFormProps> = ({ selected, wallet, setWallet }) => {

  const generateBurnerWallet = () => {
    setWallet(ethers.Wallet.createRandom())
  }

  if (selected.id === 'burner') {
    return (
      <div>
        <button className="bg-blue-400 hover:bg-blue-400 text-white py-2 px-4 mt-4" onClick={generateBurnerWallet}>Generate wallet</button>

        {wallet && 
          <div className="text-sm mt-4">
            <div>Private key: &lt;hidden&gt;</div>
            <div>Public key: ${wallet.publicKey.slice(0, 10)}...</div>
          </div>
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

const ChatApp: React.FC = () => {
  const [selected, setSelected] = useState(LoginOptions[0])
  const [wallet, setWallet] = useState(null);

  return (
    <div>
      <div className="fixed top-0 p-4">
        <span>Chat</span>
        <span className="text-xs"> with Canvas</span>
      </div>

      <div className="w-96 my-0 mx-auto pt-24">
        <LoginSelect selected={selected} setSelected={setSelected} />
        <LoginForm wallet={wallet} setWallet={setWallet} selected={selected} />
      </div>
    </div>
  )
};

export default ChatApp;