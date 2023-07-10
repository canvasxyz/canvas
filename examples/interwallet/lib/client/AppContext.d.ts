/// <reference types="react" />
import { PrivateUserRegistration, Room } from "../shared/index.js";
export interface AppContext {
    user: PrivateUserRegistration | null;
    setUser: (user: PrivateUserRegistration | null) => void;
    currentRoom: Room | null;
    setCurrentRoom: (room: Room | null) => void;
}
export declare const AppContext: import("react").Context<AppContext>;
