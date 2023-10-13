import React, { useContext } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { NewChatModal } from "./NewChatModal.js";
import { RoomName } from "./RoomName.js";
import { db } from "../db.js";
import { AppContext } from "../AppContext.js";
export const ChatSidebar = ({}) => {
    const [showNewChatModal, setShowNewChatModal] = React.useState(false);
    const rooms = useLiveQuery(() => db.rooms.toArray(), []) ?? [];
    const { user } = useContext(AppContext);
    if (user === null) {
        return null;
    }
    return (React.createElement("div", null,
        React.createElement("div", { className: "flex flex-col items-stretch" },
            React.createElement("button", { onClick: () => setShowNewChatModal(true), className: "p-2 m-2 text-left text-white font-bold text-center rounded hover:bg-blue-800 hover:cursor-pointer bg-blue-600" }, "New conversation")),
        React.createElement("div", { className: "overflow-scroll flex flex-col items-stretch" }, rooms.map((room) => (React.createElement(ChatSidebarRoom, { key: room.id, room: room })))),
        showNewChatModal && React.createElement(NewChatModal, { creator: user, onClose: () => setShowNewChatModal(false) })));
};
const ChatSidebarRoom = ({ room }) => {
    const { currentRoom, setCurrentRoom } = useContext(AppContext);
    if (room.id === currentRoom?.id) {
        return (React.createElement("button", { key: room.id, className: "pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-200", disabled: true },
            React.createElement("span", { className: "text-sm font-bold" },
                React.createElement(RoomName, { room: room }))));
    }
    else {
        return (React.createElement("button", { key: room.id, className: "pt-2 pb-2 pl-2 pr-4 m-2 text-left rounded hover:bg-gray-300 hover:cursor-pointer bg-gray-50", onClick: (e) => setCurrentRoom(room) },
            React.createElement("span", { className: "text-sm" },
                React.createElement(RoomName, { room: room }))));
    }
};
