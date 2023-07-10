import type { Codec } from 'protons-runtime';
import type { Uint8ArrayList } from 'uint8arraylist';
export interface SignedData {
    publicKey: Uint8Array;
    signature: Uint8Array;
    data: Uint8Array;
}
export declare namespace SignedData {
    const codec: () => Codec<SignedData>;
    const encode: (obj: Partial<SignedData>) => Uint8Array;
    const decode: (buf: Uint8Array | Uint8ArrayList) => SignedData;
}
export interface EncryptedEvent {
    senderAddress: Uint8Array;
    roomId: string;
    timestamp: bigint;
    nonce: Uint8Array;
    commitment: Uint8Array;
    recipients: EncryptedEvent.Recipient[];
}
export declare namespace EncryptedEvent {
    interface Recipient {
        publicKey: Uint8Array;
        ciphertext: Uint8Array;
    }
    namespace Recipient {
        const codec: () => Codec<Recipient>;
        const encode: (obj: Partial<Recipient>) => Uint8Array;
        const decode: (buf: Uint8Array | Uint8ArrayList) => Recipient;
    }
    const codec: () => Codec<EncryptedEvent>;
    const encode: (obj: Partial<EncryptedEvent>) => Uint8Array;
    const decode: (buf: Uint8Array | Uint8ArrayList) => EncryptedEvent;
}
export interface SignedUserRegistration {
    signature: Uint8Array;
    address: Uint8Array;
    keyBundle?: SignedUserRegistration.KeyBundle;
}
export declare namespace SignedUserRegistration {
    interface KeyBundle {
        signingPublicKey: Uint8Array;
        encryptionPublicKey: Uint8Array;
    }
    namespace KeyBundle {
        const codec: () => Codec<KeyBundle>;
        const encode: (obj: Partial<KeyBundle>) => Uint8Array;
        const decode: (buf: Uint8Array | Uint8ArrayList) => KeyBundle;
    }
    const codec: () => Codec<SignedUserRegistration>;
    const encode: (obj: Partial<SignedUserRegistration>) => Uint8Array;
    const decode: (buf: Uint8Array | Uint8ArrayList) => SignedUserRegistration;
}
export interface RoomRegistration {
    creatorAddress: Uint8Array;
    timestamp: bigint;
    members: SignedUserRegistration[];
}
export declare namespace RoomRegistration {
    const codec: () => Codec<RoomRegistration>;
    const encode: (obj: Partial<RoomRegistration>) => Uint8Array;
    const decode: (buf: Uint8Array | Uint8ArrayList) => RoomRegistration;
}
