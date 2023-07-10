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
import path from "node:path";
import { logger } from "@libp2p/logger";
import { bytesToHex } from "@noble/hashes/utils";
import delay from "delay";
import { openStore } from "@canvas-js/store/node";
import { ROOM_REGISTRY_TOPIC, USER_REGISTRY_TOPIC, assert, validateEvent, validateRoomRegistration, validateUserRegistration, } from "#utils";
import { getLibp2p } from "./libp2p.js";
import { applyRoomRegistration, applyUserRegistration, getRooms } from "./db.js";
import { dataDirectory } from "./config.js";
import { PING_DELAY, PING_INTERVAL, PING_TIMEOUT } from "./constants.js";
import { anySignal } from "any-signal";
export class RoomManager {
    static async initialize(peerId) {
        const libp2p = await getLibp2p(peerId);
        const manager = new RoomManager(libp2p);
        manager.roomRegistry = await openStore(libp2p, {
            path: path.resolve(dataDirectory, "rooms"),
            topic: ROOM_REGISTRY_TOPIC,
            apply: manager.applyRoomRegistryEntry,
        });
        manager.userRegistry = await openStore(libp2p, {
            path: path.resolve(dataDirectory, "users"),
            topic: USER_REGISTRY_TOPIC,
            apply: manager.applyUserRegistryEntry,
        });
        await manager.start();
        return manager;
    }
    constructor(libp2p) {
        this.libp2p = libp2p;
        this.rooms = new Map();
        this.userRegistry = null;
        this.roomRegistry = null;
        this.controller = null;
        _RoomManager_started.set(this, false);
        this.log = logger("canvas:interwallet:manager");
        this.applyEventEntry = (room) => async (key, value) => {
            const {} = validateEvent(room, key, value);
            this.log("storing event %s in room %s", bytesToHex(key), room.id);
        };
        this.applyRoomRegistryEntry = async (key, value) => {
            const room = await validateRoomRegistration(key, value);
            this.log("registering room %s with members %o", room.id, room.members.map((member) => member.address));
            applyRoomRegistration(room);
            await this.addRoom(room);
        };
        this.applyUserRegistryEntry = async (key, value) => {
            const userRegistration = await validateUserRegistration(key, value);
            this.log("registering user %s", userRegistration.address);
            applyUserRegistration(userRegistration);
        };
    }
    isStarted() {
        return __classPrivateFieldGet(this, _RoomManager_started, "f");
    }
    async start() {
        if (this.userRegistry === null || this.roomRegistry === null) {
            throw new Error("tried to start uninitialized manager");
        }
        else if (__classPrivateFieldGet(this, _RoomManager_started, "f")) {
            return;
        }
        this.log("starting manager");
        await this.libp2p.start();
        await this.roomRegistry.start();
        await this.userRegistry.start();
        const rooms = getRooms();
        await Promise.all(rooms.map((room) => this.addRoom(room)));
        this.controller = new AbortController();
        __classPrivateFieldSet(this, _RoomManager_started, true, "f");
        this.startPingService();
    }
    async stop() {
        this.controller?.abort();
        this.controller = null;
        await this.userRegistry?.stop();
        await this.roomRegistry?.stop();
        await Promise.all([...this.rooms.values()].map(({ store }) => store.stop()));
        await this.libp2p.stop();
        __classPrivateFieldSet(this, _RoomManager_started, false, "f");
    }
    async addRoom(room) {
        const store = await openStore(this.libp2p, {
            path: path.resolve(dataDirectory, `room-${room.id}`),
            topic: `interwallet:room:${room.id}`,
            apply: this.applyEventEntry(room),
        });
        if (__classPrivateFieldGet(this, _RoomManager_started, "f")) {
            await store.start();
        }
        this.rooms.set(room.id, { store, members: room.members });
    }
    async startPingService() {
        const { ping: pingService } = this.libp2p.services;
        const log = logger("canvas:interwallet:manager:ping");
        assert(this.controller !== null);
        log("started ping service");
        const { signal } = this.controller;
        try {
            await delay(PING_DELAY, { signal });
            while (!signal.aborted) {
                const peers = this.libp2p.getPeers();
                await Promise.all(peers.map(async (peer) => {
                    const timeoutSignal = anySignal([AbortSignal.timeout(PING_TIMEOUT), signal]);
                    try {
                        const latency = await pingService.ping(peer, { signal: timeoutSignal });
                        log("peer %p responded to ping in %dms", peer, latency);
                    }
                    catch (err) {
                        log("peer %p failed to respond to ping", peer);
                        await this.libp2p.hangUp(peer);
                    }
                    finally {
                        timeoutSignal.clear();
                    }
                }));
                await delay(PING_INTERVAL, { signal });
            }
        }
        catch (err) {
            if (signal.aborted) {
                log("service aborted");
            }
            else {
                log.error("service crashed: %o", err);
            }
        }
    }
}
_RoomManager_started = new WeakMap();
