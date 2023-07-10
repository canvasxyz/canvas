import type { Libp2p } from "@libp2p/interface-libp2p";
import type { PubSub } from "@libp2p/interface-pubsub";
import type { PeerId } from "@libp2p/interface-peer-id";
import { PrivateUserRegistration, PublicUserRegistration, Room } from "#utils";
type EventMap = {
    message: {
        content: string;
        timestamp: number;
        sender: string;
    };
};
type RoomEvent = {
    [Type in keyof EventMap]: {
        type: Type;
        detail: EventMap[Type];
    };
}[keyof EventMap];
export declare class RoomManager {
    #private;
    readonly libp2p: Libp2p<{
        pubsub: PubSub;
    }>;
    readonly user: PrivateUserRegistration;
    static initialize(peerId: PeerId, user: PrivateUserRegistration): Promise<RoomManager>;
    private readonly rooms;
    private userRegistry;
    private roomRegistry;
    private readonly log;
    private constructor();
    isStarted(): boolean;
    start(): Promise<void>;
    stop(): Promise<void>;
    createRoom(members: PublicUserRegistration[]): Promise<Room>;
    dispatchEvent(roomId: string, event: RoomEvent): Promise<void>;
    private applyEventEntry;
    private applyRoomRegistryEntry;
    private applyUserRegistryEntry;
    private addRoom;
}
export {};
