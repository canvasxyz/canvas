import { openStore } from "@canvas-js/store/browser";
import { libp2p } from "./libp2p.js";
import { ROOM_REGISTRY_TOPIC, USER_REGISTRY_TOPIC, assert, encodeRoomRegistration, decodeRoomRegistration, decodeUserRegistration, encodeUserRegistration, encodeEncryptedEvent, decodeEncryptedEvent, } from "../shared/index.js";
export const roomRegistry = await openStore(libp2p, {
    topic: ROOM_REGISTRY_TOPIC,
    encode: encodeRoomRegistration,
    decode: decodeRoomRegistration,
});
export const userRegistry = await openStore(libp2p, {
    topic: USER_REGISTRY_TOPIC,
    encode: encodeUserRegistration,
    decode: decodeUserRegistration,
});
const rooms = new Map();
async function addRoomEventStore(room) {
    if (rooms.has(room.id)) {
        return;
    }
    const store = await openStore(libp2p, {
        topic: `interwallet:room:${room.id}`,
        encode: async (encryptedEvent, { user }) => {
            return encodeEncryptedEvent(encryptedEvent, { user });
        },
        decode: async (value) => {
            return await decodeEncryptedEvent(value, { room });
        },
    });
    rooms.set(room.id, store);
}
export async function createRoom(members, user) {
    assert(members.find((member) => member.address === user.address));
    roomRegistry.publish({ creator: user.address, members }, { user });
}
