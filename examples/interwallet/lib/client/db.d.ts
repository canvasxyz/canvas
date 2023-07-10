import Dexie, { Table } from "dexie";
import type { Room, PublicUserRegistration } from "../shared/index.js";
export type Message = {
    room: string;
    sender: string;
    content: string;
    timestamp: number;
};
declare class InterwalletChatDB extends Dexie {
    users: Table<PublicUserRegistration, string>;
    rooms: Table<Room, string>;
    messages: Table<Message, number>;
    constructor();
}
export declare const db: InterwalletChatDB;
export {};
