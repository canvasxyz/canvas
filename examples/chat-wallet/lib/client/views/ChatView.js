import React, { useCallback, useContext, useState } from "react";
import { ChatSidebar } from "./ChatSidebar.js";
import { MessagesPanel } from "./MessagesPanel.js";
import { StatusPanel } from "./StatusPanel.js";
import { RoomName } from "./RoomName.js";
import { ReactComponent as chevronRight } from "../../../icons/chevron-right.svg";
import { ReactComponent as chevronLeft } from "../../../icons/chevron-left.svg";
import { AppContext } from "../AppContext.js";
import { getRegistrationKey } from "../utils.js";
export const ChatView = ({}) => {
    const [showStatusPanel, setShowStatusPanel] = useState(true);
    const statusPanelIcon = showStatusPanel ? chevronRight : chevronLeft;
    const { user, setUser, currentRoom, setCurrentRoom } = useContext(AppContext);
    const logout = useCallback(() => {
        setUser(null);
        setCurrentRoom(null);
        if (user !== null) {
            window.localStorage.removeItem(getRegistrationKey(user.address));
        }
    }, [user]);
    if (user === null) {
        return null;
    }
    return (React.createElement("div", { className: "w-screen h-screen bg-white overflow-x-scroll" },
        React.createElement("div", { className: "h-full flex flex-row min-w-min items-stretch" },
            React.createElement("div", { className: "grow grid grid-cols-chat-view grid-rows-chat-view divide-x divide-y divide-gray-300" },
                React.createElement("div", { className: "px-4 self-center" },
                    React.createElement("h1", null, "Encrypted Chat")),
                React.createElement("div", { className: "flex flex-row" },
                    React.createElement("div", { className: "px-4 self-center grow" }, currentRoom && React.createElement(RoomName, { room: currentRoom })),
                    React.createElement("button", { className: "px-4 self-stretch hover:bg-gray-100", onClick: logout }, "Logout"),
                    React.createElement("button", { className: "px-4 self-stretch hover:bg-gray-100", onClick: () => setShowStatusPanel(!showStatusPanel) }, statusPanelIcon({ width: 24, height: 24 }))),
                React.createElement(ChatSidebar, null),
                React.createElement("div", { className: "flex flex-row grow items-stretch overflow-y-hidden" }, currentRoom ? (React.createElement(MessagesPanel, null)) : (React.createElement("div", { className: "px-4 m-auto text-3xl font-semibold text-gray-500" }, "No chat is selected")))),
            showStatusPanel && React.createElement(StatusPanel, null))));
};
