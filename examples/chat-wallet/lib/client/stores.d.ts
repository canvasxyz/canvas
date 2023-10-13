import { Store } from "@canvas-js/store";
import { PublicUserRegistration, RoomRegistration, PrivateUserRegistration, Room, RoomEvent, EventMap } from "../shared/index.js";
export declare const roomRegistry: Store<RoomRegistration, {
    user: PrivateUserRegistration;
}>;
export declare const userRegistry: Store<PublicUserRegistration, void>;
export declare function addRoomEventStore(user: PrivateUserRegistration, room: Room): Promise<Store<RoomEvent>>;
export declare function publishEvent<T extends keyof EventMap>(roomId: string, type: T, detail: EventMap[T]): Promise<void>;
export declare function createRoom(members: PublicUserRegistration[], user: PrivateUserRegistration): Promise<void>;
