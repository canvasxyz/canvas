import { useLiveQuery } from "@canvas-js/hooks";
import { useChat } from "../hooks/useChat";
import { useState } from "react";

export const DashboardView = () => {
  const { app } = useChat();
  const [message, setMessage] = useState<string | undefined>(undefined);

  const lobby = useLiveQuery(app, "messages", { orderBy: { timestamp: "desc" } });

  const msgOnChange = (evt: any) => {
    setMessage(evt.target.value);
  }

  const sendMessage = () => {
    app.actions.sendMessage({ content: message });
  }

  const getMessages = () => {
    return (
      <ul className="h-100">
        {lobby?.map((message) => (
          <div>message: {message.content}</div>
        ))}
      </ul>
    )
  };

  return (
    <div>
      {getMessages()}
      <div className="flex">
        <input className="border border-gray-600 mr-2" type="text" onChange={msgOnChange} value={message} />
        <button className="bg-blue-400 hover:bg-blue-400 text-white py-1 px-2 text-xs rounded" type="button" onClick={sendMessage} value={message}>Send message</button>
      </div>
    </div>
  );
};