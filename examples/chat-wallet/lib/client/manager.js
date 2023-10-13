var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _RoomManager_started;
import { getAddress, hexToBytes } from "viem";
import { blake3 } from "@noble/hashes/blake3";
import { logger } from "@libp2p/logger";
import { encode, decode } from "microcbor";
import { base58btc } from "multiformats/bases/base58";
import nacl from "tweetnacl";
import { openStore } from "@canvas-js/store/browser";
import * as Messages from "#utils/messages";
import { ROOM_REGISTRY_TOPIC, USER_REGISTRY_TOPIC, assert, validateRoomRegistration, validateUserRegistration, validateEvent, } from "#utils";
import { db } from "./db.js";
import { getLibp2p } from "./libp2p.js";
const serializePublicUserRegistration = (user) => ({
    address: hexToBytes(user.address),
    signature: hexToBytes(user.keyBundleSignature),
    keyBundle: {
        signingPublicKey: hexToBytes(user.keyBundle.signingPublicKey),
        encryptionPublicKey: hexToBytes(user.keyBundle.encryptionPublicKey),
    },
});
export class RoomManager {
    static async initialize(peerId, user) {
        const libp2p = await getLibp2p(peerId);
        const manager = new RoomManager(libp2p, user);
        manager.roomRegistry = await openStore(libp2p, {
            topic: ROOM_REGISTRY_TOPIC,
            apply: manager.applyRoomRegistryEntry,
        });
        manager.userRegistry = await openStore(libp2p, {
            topic: USER_REGISTRY_TOPIC,
            apply: manager.applyUserRegistryEntry,
        });
        await manager.start();
        return manager;
    }
    constructor(libp2p, user) {
        this.libp2p = libp2p;
        this.user = user;
        this.rooms = new Map();
        this.userRegistry = null;
        this.roomRegistry = null;
        _RoomManager_started.set(this, false);
        this.log = logger("canvas:interwallet:manager");
        this.applyEventEntry = (room) => async (key, value) => {
            const { encryptedEvent, sender, recipient } = validateEvent(room, key, value);
            const otherPublicUserRegistration = room.members.find(({ address }) => getAddress(address) !== this.user.address);
            assert(otherPublicUserRegistration !== undefined, "failed to find other room member");
            const decryptedEvent = nacl.box.open(encryptedEvent.ciphertext, encryptedEvent.nonce, hexToBytes(otherPublicUserRegistration.keyBundle.encryptionPublicKey), hexToBytes(this.user.encryptionPrivateKey));
            assert(decryptedEvent !== null, "failed to decrypt room event");
            const event = decode(decryptedEvent);
            if (event.type === "message") {
                const id = await db.messages.add({ room: room.id, ...event.detail });
                console.log("added message with id", id);
            }
            else {
                throw new Error("invalid event type");
            }
        };
        this.applyRoomRegistryEntry = async (key, value) => {
            const room = await validateRoomRegistration(key, value);
            if (room.members.find(({ address }) => address === this.user.address)) {
                await db.rooms.add(room);
                await this.addRoom(room);
            }
        };
        this.applyUserRegistryEntry = async (key, value) => {
            const userRegistration = await validateUserRegistration(key, value);
            await db.users.add(userRegistration);
        };
    }
    isStarted() {
        return __classPrivateFieldGet(this, _RoomManager_started, "f");
    }
    async start() {
        if (this.userRegistry === null || this.roomRegistry === null) {
            throw new Error("tried to start uninitialized manager");
        }
        else if (this.libp2p.isStarted()) {
            return;
        }
        this.log("starting manager");
        await this.libp2p.start();
        await this.roomRegistry.start();
        await this.userRegistry.start();
        const rooms = await db.rooms.toArray();
        await Promise.all(rooms.map((room) => this.addRoom(room)));
        const key = hexToBytes(this.user.address);
        const existingRegistration = await this.userRegistry.get(key);
        if (existingRegistration === null) {
            this.log("publishing self user registration");
            const value = Messages.SignedUserRegistration.encode(serializePublicUserRegistration(this.user));
            await this.userRegistry.insert(key, value);
        }
        __classPrivateFieldSet(this, _RoomManager_started, true, "f");
    }
    async stop() {
        await this.userRegistry?.stop();
        await this.roomRegistry?.stop();
        await Promise.all([...this.rooms.values()].map(({ store }) => store.stop()));
        await this.libp2p.stop();
        __classPrivateFieldSet(this, _RoomManager_started, false, "f");
    }
    async createRoom(members) {
        this.log("creating new room");
        assert(this.roomRegistry !== null, "manager not initialized");
        assert(members.find(({ address }) => address === this.user.address), "members did not include the current user");
        const hash = blake3.create({ dkLen: 16 });
        for (const { address } of members) {
            hash.update(hexToBytes(address));
        }
        const key = hash.digest();
        const roomRegistration = Messages.RoomRegistration.encode({
            creator: hexToBytes(this.user.address),
            members: members.map(serializePublicUserRegistration),
        });
        const signature = nacl.sign.detached(roomRegistration, hexToBytes(this.user.signingPrivateKey));
        const value = Messages.SignedData.encode({ signature, data: roomRegistration });
        await this.roomRegistry.insert(key, value);
        const roomId = base58btc.baseEncode(key);
        return { id: roomId, creator: this.user.address, members };
    }
    async dispatchEvent(roomId, event) {
        this.log("dispatching %s room event", event.type);
        const room = this.rooms.get(roomId);
        assert(room !== undefined, `room id ${roomId} not found`);
        const recipient = room.members.find(({ address }) => this.user.address !== address);
        assert(recipient !== undefined, "room has no other members");
        const publicKey = hexToBytes(recipient.keyBundle.encryptionPublicKey);
        const nonce = nacl.randomBytes(nacl.box.nonceLength);
        const ciphertext = nacl.box(encode(event), nonce, publicKey, hexToBytes(this.user.encryptionPrivateKey));
        const encryptedData = Messages.EncryptedEvent.encode({
            publicKey,
            ciphertext,
            nonce,
            roomId: base58btc.baseDecode(roomId),
            userAddress: hexToBytes(this.user.address),
        });
        const signature = nacl.sign.detached(encryptedData, hexToBytes(this.user.signingPrivateKey));
        const signedData = Messages.SignedData.encode({ signature, data: encryptedData });
        const key = blake3(signedData, { dkLen: 16 });
        await room.store.insert(key, signedData);
    }
    async addRoom(room) {
        this.log("adding room %s with members %o", room.id, room.members.map(({ address }) => address));
        const store = await openStore(this.libp2p, {
            topic: `interwallet:room:${room.id}`,
            apply: this.applyEventEntry(room),
        });
        if (this.libp2p.isStarted()) {
            await store.start();
        }
        this.rooms.set(room.id, { store, members: room.members });
    }
}
_RoomManager_started = new WeakMap();
