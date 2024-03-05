import { useContext } from "react";
import { ChatContext, ChatContextType } from "../contexts/chatProvider";

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// export const useChatOld = () => {
//   const [signer, setSigner] = useState<SIWESigner>();
//   const [word, setWord] = useState<string>('');

//   const signers = useMemo(() => {
//     if (signer) {
//       return [new SIWESigner({signer: ethers.Wallet.createRandom()})];
//     }

//     return [];
//   }, [signer]);

//   const app = useCanvas({
//     contract, 
//     signers: signers,
//   });

//   return { app, topic: contract.topic, signer, setSigner, word, setWord };
// }