import { createContext } from "react";
export const AppContext = createContext({
    user: null,
    setUser: () => {
        throw new Error("missing AppContext provider");
    },
    currentRoom: null,
    setCurrentRoom: (room) => {
        throw new Error("missing AppContext provider");
    },
});
