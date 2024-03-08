import React from 'react';
import { LoginView } from './views/Login';
import { DashboardView } from './views/Dashboard';
import { useChat } from './hooks/useChat';
import { ChatProvider } from './contexts/chatProvider';
import { VIEWS } from './types/views';
import { WelcomeView } from './views/Welcome';

const ChatWrapper: React.FC = () => {
  return (
    <ChatProvider>
      <ChatApp />
    </ChatProvider>
  )
};

const ChatApp: React.FC = () => {
  const { view, setView, signerAddress, setSignerAddress } = useChat();

  const goToLogin = () => {
    setView(VIEWS.Login);
  }

  const goToLogout = () => {
    setView(VIEWS.Login);
    setSignerAddress(undefined);
  }

  const goToWelcome = () => {
    setView(VIEWS.Welcome);
  }

  return (
    <div>
      <div className="fixed flex justify-between top-0 p-4 w-full">
        <div className="cursor-pointer" onClick={goToWelcome}>
          <span>Chat</span>
          <span className="text-xs"> with Canvas</span>
        </div>
        <div>
          {signerAddress && 
            <div>User: {signerAddress.slice(0, 10)} (<a className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline" href="#" onClick={goToLogout}>logout</a>)</div>
          }
          {!signerAddress &&
            <div>User: none (<a className="font-medium text-blue-600 underline dark:text-blue-500 hover:no-underline" href="#" onClick={goToLogin}>login</a>)</div>
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

        {view === VIEWS.Welcome && 
          <WelcomeView />
        }
      </div>
    </div>
  )
};

export default ChatWrapper;