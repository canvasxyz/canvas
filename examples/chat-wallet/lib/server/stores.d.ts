import { Store } from "@canvas-js/store";
import { PublicUserRegistration, RoomRegistration, PrivateUserRegistration } from "../shared/index.js";
export declare const roomRegistry: Store<RoomRegistration, {
    user: PrivateUserRegistration;
}>;
export declare const userRegistry: Store<PublicUserRegistration, void>;
export declare function createRoom(members: PublicUserRegistration[], user: PrivateUserRegistration): Promise<void>;
