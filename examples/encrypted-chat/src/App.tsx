import React from 'react';
import { LoginView } from './views/Login';
import { DashboardView } from './views/Dashboard';
import { useChat } from './hooks/useChat';
import { ChatProvider } from './contexts/chatProvider';
import { VIEWS } from './types/views';

const ChatWrapper: React.FC = () => {
  return (
    <ChatProvider>
      <ChatApp />
    </ChatProvider>
  )
};

const ChatApp: React.FC = () => {  
  const { view, setView, signerAddress } = useChat();

  const goToLogin = () => {
    setView(VIEWS.Login);
  }

  return (
    <ChatProvider>
      <div>
        <div className="fixed flex justify-between top-0 p-4 w-full">
          <div>
            <span>Chat</span>
            <span className="text-xs"> with Canvas</span>
          </div>
          <div>
            {signerAddress && 
              <div>User: {signerAddress.slice(0, 10)}</div>
            }
            {!signerAddress &&
              <div>User: none (<a href="#" onClick={goToLogin}>login</a>)</div>
            }
          </div>
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
    </ChatProvider>
  )
};

export default ChatWrapper;