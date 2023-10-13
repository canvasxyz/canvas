import { createContext } from "react";
export const AppContext = createContext({
    peerId: null,
    manager: null,
    user: null,
    setUser() {
        throw new Error("Missing AppContext provider");
    },
    room: null,
    setRoom() {
        throw new Error("Missing AppContext provider");
    },
});
