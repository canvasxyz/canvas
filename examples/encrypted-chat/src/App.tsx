import React, { useState } from 'react';
import { ethers } from "ethers";
import { LoginSelect, LoginOptions } from './views/Login-Select';
import { LoginView } from './views/Login';
import { DashboardView } from './views/Dashboard';
import { useChat } from './hooks/useChat';
import { useView, VIEWS } from './hooks/useView';

const ChatApp: React.FC = () => {
  // Initialize the contract
  useChat();
  
  const { view } = useView();

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