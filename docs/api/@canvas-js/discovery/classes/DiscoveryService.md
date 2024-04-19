[Documentation](../../../index.md) / [@canvas-js/discovery](../index.md) / DiscoveryService

# Class: DiscoveryService

## Extends

- `TypedEventEmitter`\<`DiscoveryServiceEvents`\>

## Implements

- `PeerDiscovery`
- `Startable`

## Constructors

### new DiscoveryService(components, init)

> **new DiscoveryService**(`components`, `init`): [`DiscoveryService`](DiscoveryService.md)

#### Parameters

• **components**: [`DiscoveryServiceComponents`](../interfaces/DiscoveryServiceComponents.md)

• **init**: [`DiscoveryServiceInit`](../interfaces/DiscoveryServiceInit.md)

#### Returns

[`DiscoveryService`](DiscoveryService.md)

#### Overrides

`TypedEventEmitter<DiscoveryServiceEvents>.constructor`

#### Source

[packages/discovery/src/service.ts:137](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L137)

## Properties

### #dialQueue

> **`private`** **`readonly`** **#dialQueue**: `default`\<`default`, `QueueAddOptions`\>

#### Source

[packages/discovery/src/service.ts:131](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L131)

***

### #discoveryQueue

> **`private`** **`readonly`** **#discoveryQueue**: `default`\<`default`, `QueueAddOptions`\>

#### Source

[packages/discovery/src/service.ts:130](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L130)

***

### #evictionTimer

> **`private`** **#evictionTimer**: `null` \| `Timeout` = `null`

#### Source

[packages/discovery/src/service.ts:135](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L135)

***

### #heartbeatTimer

> **`private`** **#heartbeatTimer**: `null` \| `Timeout` = `null`

#### Source

[packages/discovery/src/service.ts:134](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L134)

***

### #private

> **`private`** **#private**: `any`

#### Inherited from

`TypedEventEmitter.#private`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:28

***

### #registrarId

> **`private`** **#registrarId**: `null` \| `string` = `null`

#### Source

[packages/discovery/src/service.ts:133](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L133)

***

### addressFilter

> **`private`** **`readonly`** **addressFilter**: (`addr`) => `boolean`

#### Parameters

• **addr**: `Multiaddr`

#### Returns

`boolean`

#### Source

[packages/discovery/src/service.ts:115](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L115)

***

### appTopic

> **`private`** **`readonly`** **appTopic**: `null` \| `string`

#### Source

[packages/discovery/src/service.ts:127](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L127)

***

### autoDialPriority

> **`private`** **`readonly`** **autoDialPriority**: `number`

#### Source

[packages/discovery/src/service.ts:113](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L113)

***

### components

> **`readonly`** **components**: [`DiscoveryServiceComponents`](../interfaces/DiscoveryServiceComponents.md)

#### Source

[packages/discovery/src/service.ts:138](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L138)

***

### discoveryInterval

> **`private`** **`readonly`** **discoveryInterval**: `number`

#### Source

[packages/discovery/src/service.ts:117](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L117)

***

### discoveryPeers

> **`private`** **`readonly`** **discoveryPeers**: [`PresenceStore`](../type-aliases/PresenceStore.md) = `{}`

#### Source

[packages/discovery/src/service.ts:122](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L122)

***

### discoveryTopic

> **`private`** **`readonly`** **discoveryTopic**: `null` \| `string`

#### Source

[packages/discovery/src/service.ts:116](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L116)

***

### evictionInterval

> **`private`** **`readonly`** **evictionInterval**: `number`

#### Source

[packages/discovery/src/service.ts:119](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L119)

***

### evictionThreshold

> **`private`** **`readonly`** **evictionThreshold**: `number`

#### Source

[packages/discovery/src/service.ts:118](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L118)

***

### fetch

> **`private`** **`readonly`** **fetch**: `Fetch`

#### Source

[packages/discovery/src/service.ts:109](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L109)

***

### lastResponseHeartbeat

> **`private`** **lastResponseHeartbeat**: `number`

#### Source

[packages/discovery/src/service.ts:124](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L124)

***

### log

> **`private`** **`readonly`** **log**: `Logger`

#### Source

[packages/discovery/src/service.ts:111](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L111)

***

### minPeersPerTopic

> **`private`** **`readonly`** **minPeersPerTopic**: `number`

#### Source

[packages/discovery/src/service.ts:112](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L112)

***

### pubsub

> **`private`** **`readonly`** **pubsub**: `GossipSub`

#### Source

[packages/discovery/src/service.ts:108](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L108)

***

### responseHeartbeatThreshold

> **`private`** **`readonly`** **responseHeartbeatThreshold**: `number`

#### Source

[packages/discovery/src/service.ts:120](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L120)

***

### signers

> **`private`** **`readonly`** **signers**: `null` \| [`SignerCache`](../../interfaces/classes/SignerCache.md)

#### Source

[packages/discovery/src/service.ts:126](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L126)

***

### topicFilter

> **`private`** **`readonly`** **topicFilter**: (`topic`) => `boolean`

#### Parameters

• **topic**: `string`

#### Returns

`boolean`

#### Source

[packages/discovery/src/service.ts:114](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L114)

***

### topologyPeers

> **`private`** **`readonly`** **topologyPeers**: `Set`\<`string`\>

#### Source

[packages/discovery/src/service.ts:121](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L121)

***

### trackAllPeers

> **`private`** **`readonly`** **trackAllPeers**: `boolean`

#### Source

[packages/discovery/src/service.ts:128](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L128)

***

### AUTO\_DIAL\_PRIORITY

> **`static`** **AUTO\_DIAL\_PRIORITY**: `number` = `1`

#### Source

[packages/discovery/src/service.ts:96](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L96)

***

### FETCH\_ALL\_KEY\_PREFIX

> **`static`** **FETCH\_ALL\_KEY\_PREFIX**: `string` = `"discovery-all/"`

#### Source

[packages/discovery/src/service.ts:91](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L91)

***

### FETCH\_KEY\_PREFIX

> **`static`** **FETCH\_KEY\_PREFIX**: `string` = `"discovery/"`

#### Source

[packages/discovery/src/service.ts:90](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L90)

***

### MIN\_PEERS\_PER\_TOPIC

> **`static`** **MIN\_PEERS\_PER\_TOPIC**: `number` = `5`

#### Source

[packages/discovery/src/service.ts:93](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L93)

***

### NEW\_CONNECTION\_TIMEOUT

> **`static`** **NEW\_CONNECTION\_TIMEOUT**: `number`

#### Source

[packages/discovery/src/service.ts:94](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L94)

***

### NEW\_STREAM\_TIMEOUT

> **`static`** **NEW\_STREAM\_TIMEOUT**: `number`

#### Source

[packages/discovery/src/service.ts:95](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L95)

## Accessors

### [peerDiscoverySymbol]

> **`get`** **[peerDiscoverySymbol]**(): `PeerDiscovery`

#### Returns

`PeerDiscovery`

#### Source

[packages/discovery/src/service.ts:159](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L159)

***

### [toStringTag]

> **`get`** **[toStringTag]**(): `"@canvas-js/discovery"`

#### Returns

`"@canvas-js/discovery"`

#### Source

[packages/discovery/src/service.ts:163](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L163)

## Methods

### addEventListener()

> **addEventListener**\<`K`\>(`type`, `listener`, `options`?): `void`

#### Type parameters

• **K** extends keyof `DiscoveryServiceEvents`

#### Parameters

• **type**: `K`

• **listener**: `null` \| `EventHandler`\<`DiscoveryServiceEvents`\[`K`\]\>

• **options?**: `boolean` \| `AddEventListenerOptions`

#### Returns

`void`

#### Implementation of

`PeerDiscovery.addEventListener`

#### Inherited from

`TypedEventEmitter.addEventListener`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:30

***

### afterStart()

> **afterStart**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`Startable.afterStart`

#### Source

[packages/discovery/src/service.ts:191](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L191)

***

### beforeStop()

> **beforeStop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`Startable.beforeStop`

#### Source

[packages/discovery/src/service.ts:332](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L332)

***

### connect()

> **`private`** **connect**(`peerId`, `multiaddrs`): `Promise`\<`void`\>

#### Parameters

• **peerId**: [`PeerId`](../../core/type-aliases/PeerId.md)

• **multiaddrs**: `Multiaddr`[]

#### Returns

`Promise`\<`void`\>

#### Source

[packages/discovery/src/service.ts:474](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L474)

***

### dispatchEvent()

> **dispatchEvent**(`event`): `boolean`

#### Parameters

• **event**: `Event`

#### Returns

`boolean`

#### Implementation of

`PeerDiscovery.dispatchEvent`

#### Inherited from

`TypedEventEmitter.dispatchEvent`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:32

***

### handleConnect()

> **`private`** **handleConnect**(`connection`): `void`

#### Parameters

• **connection**: [`Connection`](../../core/interfaces/Connection.md)

#### Returns

`void`

#### Source

[packages/discovery/src/service.ts:406](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L406)

***

### handleFetch()

> **`private`** **handleFetch**(`key`): `Promise`\<`undefined` \| `Uint8Array`\>

#### Parameters

• **key**: `string`

#### Returns

`Promise`\<`undefined` \| `Uint8Array`\>

#### Source

[packages/discovery/src/service.ts:355](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L355)

***

### handlePeerEvent()

> **`private`** **handlePeerEvent**(`peerId`, `multiaddrs`, `env`, `address`, `topics`, `discoveryType`): `Promise`\<`void`\>

#### Parameters

• **peerId**: [`PeerId`](../../core/type-aliases/PeerId.md)

• **multiaddrs**: `Multiaddr`[]

• **env**: `"browser"` \| `"server"`

• **address**: `null` \| `string`= `null`

• **topics**: `string`[]= `[]`

• **discoveryType**: `"active"` \| `"passive"`

#### Returns

`Promise`\<`void`\>

#### Source

[packages/discovery/src/service.ts:515](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L515)

***

### isStarted()

> **isStarted**(): `boolean`

#### Returns

`boolean`

#### Source

[packages/discovery/src/service.ts:167](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L167)

***

### listenerCount()

> **listenerCount**(`type`): `number`

#### Parameters

• **type**: `string`

#### Returns

`number`

#### Implementation of

`PeerDiscovery.listenerCount`

#### Inherited from

`TypedEventEmitter.listenerCount`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:29

***

### openPeerRecord()

> **`private`** **openPeerRecord**(`envelope`): `Promise`\<`Object`\>

#### Parameters

• **envelope**: `Uint8Array`

#### Returns

`Promise`\<`Object`\>

> ##### multiaddrs
>
> > **multiaddrs**: `Multiaddr`[]
>
> ##### peerId
>
> > **peerId**: [`PeerId`](../../core/type-aliases/PeerId.md)
>

#### Source

[packages/discovery/src/service.ts:467](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L467)

***

### publishHeartbeat()

> **`private`** **publishHeartbeat**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Source

[packages/discovery/src/service.ts:289](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L289)

***

### removeEventListener()

> **removeEventListener**\<`K`\>(`type`, `listener`?, `options`?): `void`

#### Type parameters

• **K** extends keyof `DiscoveryServiceEvents`

#### Parameters

• **type**: `K`

• **listener?**: `null` \| `EventHandler`\<`DiscoveryServiceEvents`\[`K`\]\>

• **options?**: `boolean` \| `EventListenerOptions`

#### Returns

`void`

#### Implementation of

`PeerDiscovery.removeEventListener`

#### Inherited from

`TypedEventEmitter.removeEventListener`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:31

***

### safeDispatchEvent()

> **safeDispatchEvent**\<`Detail`\>(`type`, `detail`?): `boolean`

#### Type parameters

• **Detail**

#### Parameters

• **type**: keyof `DiscoveryServiceEvents`

• **detail?**: `CustomEventInit`\<`Detail`\>

#### Returns

`boolean`

#### Implementation of

`PeerDiscovery.safeDispatchEvent`

#### Inherited from

`TypedEventEmitter.safeDispatchEvent`

#### Source

node\_modules/@libp2p/interface/dist/src/event-target.d.ts:33

***

### start()

> **start**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`Startable.start`

#### Source

[packages/discovery/src/service.ts:171](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L171)

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`Startable.stop`

#### Source

[packages/discovery/src/service.ts:348](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L348)

***

### extractFetchService()

> **`private`** **`static`** **extractFetchService**(`components`): `Fetch`

#### Parameters

• **components**: [`DiscoveryServiceComponents`](../interfaces/DiscoveryServiceComponents.md)

#### Returns

`Fetch`

#### Source

[packages/discovery/src/service.ts:103](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L103)

***

### extractGossipSub()

> **`private`** **`static`** **extractGossipSub**(`components`): `GossipSub`

#### Parameters

• **components**: [`DiscoveryServiceComponents`](../interfaces/DiscoveryServiceComponents.md)

#### Returns

`GossipSub`

#### Source

[packages/discovery/src/service.ts:98](https://github.com/canvasxyz/canvas/blob/4c6b729f/packages/discovery/src/service.ts#L98)
