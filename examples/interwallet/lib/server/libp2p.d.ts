import { Libp2p } from "libp2p";
import { PingService } from "libp2p/ping";
import { GossipsubEvents } from "@chainsafe/libp2p-gossipsub";
import type { PubSub } from "@libp2p/interface-pubsub";
import type { PeerId } from "@libp2p/interface-peer-id";
export type ServiceMap = {
    identify: {};
    pubsub: PubSub<GossipsubEvents>;
    ping: PingService;
};
export declare const peerId: PeerId;
export declare const libp2p: Libp2p<{
    pubsub: PubSub<GossipsubEvents>;
    identify: import("node_modules/libp2p/dist/src/identify/identify.js").DefaultIdentifyService;
    ping: PingService;
    serviceDiscovery: import("@canvas-js/pubsub-service-discovery").ServiceDiscovery;
}>;
