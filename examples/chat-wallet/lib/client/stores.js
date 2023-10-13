import { bytesToHex, getAddress, hexToBytes } from "viem";
import { blake3 } from "@noble/hashes/blake3";
import { equals } from "uint8arrays";
import nacl from "tweetnacl";
import * as cbor from "microcbor";
import { openStore } from "@canvas-js/store/browser";
import { libp2p } from "./libp2p.js";
import { ROOM_REGISTRY_TOPIC, USER_REGISTRY_TOPIC, assert, encodeRoomRegistration, decodeRoomRegistration, decodeUserRegistration, encodeUserRegistration, encodeEncryptedEvent, decodeEncryptedEvent, } from "../shared/index.js";
import { db } from "./db.js";
export const roomRegistry = await openStore(libp2p, {
    topic: ROOM_REGISTRY_TOPIC,
    encode: encodeRoomRegistration,
    decode: decodeRoomRegistration,
});
await roomRegistry.start();
export const userRegistry = await openStore(libp2p, {
    topic: USER_REGISTRY_TOPIC,
    encode: encodeUserRegistration,
    decode: decodeUserRegistration,
});
userRegistry.addListener((id, user) => {
    console.log(`adding user ${user.address}`);
    db.users.add(user);
});
await userRegistry.start();
const rooms = new Map();
export async function addRoomEventStore(user, room) {
    const existingRoom = rooms.get(room.id);
    if (existingRoom !== undefined) {
        return existingRoom;
    }
    const store = await openStore(libp2p, {
        topic: `interwallet:room:${room.id}`,
        encode: async (event) => {
            const data = cbor.encode({ type: event.type, detail: event.detail });
            const nonce = nacl.randomBytes(nacl.box.nonceLength);
            const commitment = blake3.create({ dkLen: 16 });
            commitment.update(nonce);
            commitment.update(data);
            const otherRoomMembers = room.members.filter(({ address }) => user.address !== address);
            assert(otherRoomMembers.length > 0, "room has no other members");
            assert(otherRoomMembers.length === room.members.length - 1, "invalid room");
            const recipients = otherRoomMembers.map((otherRoomMember) => {
                const publicKey = hexToBytes(otherRoomMember.keyBundle.encryptionPublicKey);
                const ciphertext = nacl.box(data, nonce, publicKey, hexToBytes(user.encryptionPrivateKey));
                return { publicKey, ciphertext };
            });
            return encodeEncryptedEvent({
                roomId: room.id,
                senderAddress: hexToBytes(user.address),
                timestamp: BigInt(event.timestamp),
                nonce: nonce,
                commitment: commitment.digest(),
                recipients: recipients,
            }, { user });
        },
        decode: async (value) => {
            const encryptedEvent = await decodeEncryptedEvent(value, { room });
            let decryptedEvent;
            const senderAddress = getAddress(bytesToHex(encryptedEvent.senderAddress));
            if (senderAddress === user.address) {
                assert(encryptedEvent.recipients.length > 0);
                const [recipient] = encryptedEvent.recipients;
                decryptedEvent = nacl.box.open(recipient.ciphertext, encryptedEvent.nonce, recipient.publicKey, hexToBytes(user.encryptionPrivateKey));
            }
            else {
                const sender = room.members.find((member) => member.address === senderAddress);
                assert(sender !== undefined, "event sender is not a room member");
                const encryptionPublicKey = hexToBytes(user.keyBundle.encryptionPublicKey);
                const recipient = encryptedEvent.recipients.find((recipient) => equals(recipient.publicKey, encryptionPublicKey));
                assert(recipient !== undefined, "event has no recipient for the user's public key");
                decryptedEvent = nacl.box.open(recipient.ciphertext, encryptedEvent.nonce, hexToBytes(sender.keyBundle.encryptionPublicKey), hexToBytes(user.encryptionPrivateKey));
            }
            assert(decryptedEvent !== null, "failed to decrypt event");
            const commitment = blake3.create({ dkLen: 16 });
            commitment.update(encryptedEvent.nonce);
            commitment.update(decryptedEvent);
            assert(equals(commitment.digest(), encryptedEvent.commitment), "invalid event commitment");
            const timestamp = Number(encryptedEvent.timestamp);
            assert(Number.isSafeInteger(timestamp), "invalid timestamp");
            const { type, detail } = cbor.decode(decryptedEvent);
            if (type === "message") {
                return { type, roomId: room.id, timestamp, detail };
            }
            else {
                throw new Error("invalid event type");
            }
        },
    });
    store.addListener((id, event) => {
        if (event.type === "message") {
        }
        else {
            throw new Error("invalid event type");
        }
    });
    await store.start();
    rooms.set(room.id, store);
    return store;
}
export async function publishEvent(roomId, type, detail) {
    const store = rooms.get(roomId);
    assert(store !== undefined, "missing room store");
    await store.publish({ type, roomId, timestamp: Date.now(), detail });
}
export async function createRoom(members, user) {
    assert(members.find((member) => member.address === user.address));
    roomRegistry.publish({ creator: user.address, members }, { user });
}
