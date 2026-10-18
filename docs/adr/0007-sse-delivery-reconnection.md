# ADR 0007: Server-Sent Events (SSE) Delivery and Reconnection

## Status
Accepted

## Context
Contestants and participants need real-time feedback on submission progress (`QUEUED -> COMPILING -> RUNNING -> DONE`) and live leaderboard updates. WebSockets introduce complex connection state, proxy buffering issues, and bidirectional security attack surface.

## Decision
1. Use standard Server-Sent Events (SSE) over HTTP/2 for all real-time events.
2. Every event contains a monotonically increasing `id` and a JSON payload.
3. Clients use standard `EventSource` with `Last-Event-ID` header upon automatic reconnection.
4. The API maintains an in-memory ring buffer of recent events to replay missed events upon reconnect.

## Consequences
- Efficient, uni-directional streaming with native browser reconnect semantics.
- Works seamlessly through firewalls, Caddy proxy, and reverse proxies without custom socket upgrade protocols.
