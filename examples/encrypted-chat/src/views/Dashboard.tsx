import { useChat } from "../hooks/useChat";

export const DashboardView = () => {
  const { signerAddress } = useChat();

  return (
    <>
      <h1>You are now logged in. Welcome to the dashboard.</h1>
      <p>The system thinks you are user: {signerAddress}</p>
    </>
  );
};