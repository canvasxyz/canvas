import type { Libp2p } from "@libp2p/interface-libp2p";
import type { PeerId } from "@libp2p/interface-peer-id";
import { ServiceMap } from "./libp2p.js";
export declare class RoomManager {
    #private;
    readonly libp2p: Libp2p<ServiceMap>;
    static initialize(peerId: PeerId): Promise<RoomManager>;
    private readonly rooms;
    private userRegistry;
    private roomRegistry;
    private controller;
    private readonly log;
    private constructor();
    isStarted(): boolean;
    start(): Promise<void>;
    stop(): Promise<void>;
    private applyEventEntry;
    private applyRoomRegistryEntry;
    private applyUserRegistryEntry;
    private addRoom;
    private startPingService;
}
