import * as Messages from "./messages.js";
import type { KeyBundle, PrivateUserRegistration, PublicUserRegistration, Room, RoomRegistration } from "./types.js";
export declare function assert(condition: unknown, message?: string): asserts condition;
export declare const getPublicUserRegistration: ({ encryptionPrivateKey, signingPrivateKey, ...user }: PrivateUserRegistration) => PublicUserRegistration;
export declare function constructTypedKeyBundle(keyBundle: KeyBundle): {
    types: {
        readonly EIP712Domain: readonly [{
            readonly name: "name";
            readonly type: "string";
        }];
        readonly KeyBundle: readonly [{
            readonly name: "signingPublicKey";
            readonly type: "bytes";
        }, {
            readonly name: "encryptionPublicKey";
            readonly type: "bytes";
        }];
    };
    primaryType: "KeyBundle";
    domain: {
        readonly name: "InterwalletChat";
    };
    message: KeyBundle;
};
export declare function decodeUserRegistration(value: Uint8Array): Promise<PublicUserRegistration>;
export declare function encodeUserRegistration(userRegistration: PublicUserRegistration): Promise<Uint8Array>;
export declare function encodeRoomRegistration(roomRegistration: RoomRegistration, context: {
    user: PrivateUserRegistration;
}): Promise<Uint8Array>;
export declare function decodeRoomRegistration(value: Uint8Array): Promise<RoomRegistration>;
export declare function encodeEncryptedEvent(encryptedEvent: Messages.EncryptedEvent, context: {
    user: PrivateUserRegistration;
}): Promise<Uint8Array>;
export declare function decodeEncryptedEvent(value: Uint8Array, { room }: {
    room: Room;
}): Promise<Messages.EncryptedEvent>;
