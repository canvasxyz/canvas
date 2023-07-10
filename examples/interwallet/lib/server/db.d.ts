import { Room, PublicUserRegistration } from "../shared/index.js";
export declare function applyRoomRegistration(room: Room): void;
export declare function applyUserRegistration({ address, keyBundleSignature, keyBundle: { signingPublicKey, encryptionPublicKey }, }: PublicUserRegistration): void;
export declare function getUsers(): PublicUserRegistration[];
export declare function getRooms(): Room[];
