import React, { useState } from 'react';
import { ethers } from "ethers";
import { LoginSelect, LoginOptions } from './components/Select-Login';
import { LoginView } from './views/Login';
import { DashboardView } from './views/Dashboard';
import { useChat } from './hooks/useChat';

export enum VIEWS {
  Login = "LOGIN",
  Dashboard = "DASHBOARD"
}

const ChatApp: React.FC = () => {
  // const [selected, setSelected] = useState(LoginOptions[0])
  // const [wallet, setWallet] = useState(null);

  const [view, setView] = useState(VIEWS.Login);

  // Initialize everything
  useChat();

  return (
    <div>
      <div className="fixed top-0 p-4">
        <span>Chat</span>
        <span className="text-xs"> with Canvas</span>
      </div>

      <div className="w-96 my-0 mx-auto pt-24">
        {view === VIEWS.Login && 
          <LoginView />
        }

        {view === VIEWS.Dashboard && 
          <DashboardView />
        }
      </div>
    </div>
  )
};

export default ChatApp;