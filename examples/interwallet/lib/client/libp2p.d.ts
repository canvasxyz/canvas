import { Libp2p } from "libp2p";
import { PingService } from "libp2p/ping";
import { GossipsubEvents } from "@chainsafe/libp2p-gossipsub";
import type { PubSub } from "@libp2p/interface-pubsub";
export type ServiceMap = {
    identify: {};
    pubsub: PubSub<GossipsubEvents>;
    ping: PingService;
};
export declare const libp2p: Libp2p<ServiceMap>;
declare global {
    var libp2p: undefined | Libp2p<ServiceMap>;
}
