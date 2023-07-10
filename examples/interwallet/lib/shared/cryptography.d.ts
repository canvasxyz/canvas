import { WalletClient } from "viem";
import * as Messages from "./messages.js";
import type { PrivateUserRegistration, PublicUserRegistration, Room } from "./types.js";
export declare const createPrivateUserRegistration: (walletClient: WalletClient, account: `0x${string}`, pin: string) => Promise<PrivateUserRegistration>;
export declare const getRoomId: (key: Uint8Array) => string;
export declare function validateRoomRegistration(key: Uint8Array, value: Uint8Array): Promise<Room>;
export declare function validateUserRegistration(key: Uint8Array, value: Uint8Array): Promise<PublicUserRegistration>;
export declare function validateEvent(room: Room, key: Uint8Array, value: Uint8Array): {
    encryptedEvent: Messages.EncryptedEvent;
    sender: PublicUserRegistration;
    recipient: PublicUserRegistration;
};
