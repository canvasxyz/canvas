declare module "stream-to-it" {
	import type stream from "node:stream"
	import type { Source, Sink, Transform, Duplex } from "it-stream-types"
	declare function source(stream: stream.Readable): Source
	declare function sink(stream: stream.Writable): Sink
	declare function transform(stream: stream.Transform): Transform
	declare function duplex(stream: stream.Duplex): Duplex
}
