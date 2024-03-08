import { useChat } from "../hooks/useChat"
import { VIEWS } from "../types/views";

export const WelcomeView = () => {
  const { signerAddress, setSignerAddress, setView } = useChat();

  const goToLogin = () => {
    setView(VIEWS.Login)
  }

  const goToDashboard = () => {
    setView(VIEWS.Dashboard)
  }

  const logout = () => {
    setView(VIEWS.Login);
    setSignerAddress(undefined);
  }

  return (
    <div className="w-100 h-100 mx-auto text-center">
      <h3>Welcome!</h3>

      {signerAddress && (
        <div>
          <div>You are logged in as = {signerAddress.slice(0,20)}...</div>
          <button className="bg-blue-400 hover:bg-blue-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={goToDashboard}>
            Dashboard
          </button>
          <button className="bg-red-400 hover:bg-red-400 text-white py-1 px-2 mt-4 text-xs rounded ml-2" onClick={logout}>
            Logout
          </button>
        </div>

      )}

      {!signerAddress && (
        <div>
          <div>You are not logged in.</div>
          <button className="bg-blue-400 hover:bg-blue-400 text-white py-1 px-2 mt-4 text-xs rounded" onClick={goToLogin}>
            Log in
          </button>
        </div>
      )}
      
    </div>
  )
}