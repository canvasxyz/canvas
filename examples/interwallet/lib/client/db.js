import Dexie from "dexie";
class InterwalletChatDB extends Dexie {
    constructor() {
        super("interwallet:ui-db");
        this.version(1).stores({
            users: "address",
            rooms: "id, *members.address",
            messages: "++id, room, timestamp",
        });
    }
}
export const db = new InterwalletChatDB();
