import path from "node:path";
import Database from "better-sqlite3";
import { dataDirectory } from "./config.js";
const db = new Database(path.resolve(dataDirectory, "db.sqlite"));
db.exec(`CREATE TABLE IF NOT EXISTS users (
	address TEXT PRIMARY KEY,
	signing_public_key TEXT NOT NULL,
	encryption_public_key TEXT NOT NULL,
	key_bundle_signature TEXT NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, creator TEXT NOT NULL REFERENCES users(address))`);
db.exec(`CREATE TABLE IF NOT EXISTS memberships (
	user TEXT NOT NULL REFERENCES users(address),
	room TEXT NOT NULL REFERENCES rooms(id)
)`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS memberships_index ON memberships(user, room)`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS memberships_index_room ON memberships(room)`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS memberships_index_user ON memberships(user)`);
const insertUser = db.prepare(`INSERT OR IGNORE INTO users VALUES (
  :address, :signing_public_key, :encryption_public_key, :key_bundle_signature
)`);
const insertRoom = db.prepare(`INSERT OR IGNORE INTO rooms VALUES (:id, :creator)`);
const insertMembership = db.prepare(`INSERT OR IGNORE INTO memberships VALUES (:user, :room)`);
export function applyRoomRegistration(room) {
    for (const member of room.members) {
        applyUserRegistration(member);
    }
    insertRoom.run({ id: room.id, creator: room.creator });
    for (const member of room.members) {
        insertMembership.run({ user: member.address, room: room.id });
    }
}
export function applyUserRegistration({ address, keyBundleSignature, keyBundle: { signingPublicKey, encryptionPublicKey }, }) {
    insertUser.run({
        address,
        key_bundle_signature: keyBundleSignature,
        signing_public_key: signingPublicKey,
        encryption_public_key: encryptionPublicKey,
    });
}
const selectUsers = db.prepare(`SELECT * FROM users`);
const selectRooms = db.prepare(`SELECT * FROM rooms`);
const selectMemberships = db.prepare(`SELECT memberships.room, users.* FROM memberships JOIN users ON memberships.user = users.address`);
const parseUserRecord = ({ address, signing_public_key, encryption_public_key, key_bundle_signature, }) => ({
    address,
    keyBundleSignature: key_bundle_signature,
    keyBundle: { signingPublicKey: signing_public_key, encryptionPublicKey: encryption_public_key },
});
export function getUsers() {
    const userRecords = selectUsers.all();
    return userRecords.map(parseUserRecord);
}
export function getRooms() {
    const roomRecords = selectRooms.all();
    const roomMap = new Map(roomRecords.map(({ id, creator }) => [id, { id, creator, members: [] }]));
    const memberships = selectMemberships.all();
    for (const { room: roomId, ...user } of memberships) {
        const room = roomMap.get(roomId);
        if (room !== undefined) {
            room.members.push(parseUserRecord(user));
        }
    }
    return [...roomMap.values()];
}
