# 📡 WebRTC Signaling Server

A lightweight HTTP-based signaling server for WebRTC peer connections. Peers exchange SDP offers and answers via a shared secret, with in-memory caching and rate limiting built in.

---

## How It Works

WebRTC requires an out-of-band channel to exchange session descriptions (SDP) before a direct peer-to-peer connection can be established. This server acts as that channel.

1. **Caller** generates a shared `secret` and an SDP offer; **Caller** POSTs the offer via `/rtc/get-answer` (this endpoint is designed to both submit an offer and retrieve an answer in one step, to simplify client logic)
2. **Callee** polls `/rtc/get-offer` with the same secret to retrieve it
3. **Callee** POSTs an SDP answer to `/rtc/submit-answer`
4. **Caller** polls `/rtc/get-answer` to retrieve the answer; **Caller** is allowed to update their offer every time they poll for the answer, so they can include updated ICE candidates or other information as needed
5. Both peers have everything they need to establish a direct connection

```
Caller                        Server                        Callee
  |                              |                              |
  |-- POST /rtc/get-answer -->   |                              |
  |                              | <-- POST /rtc/get-offer  --  |
  |                              | --- offer -------------->    |
  |                              | <-- POST /rtc/submit-answer -|
  | <-- POST /rtc/get-answer --- |                              |
  |                              |                              |
  |========== WebRTC P2P connection established ================|
```

---

## API Reference

All endpoints accept and return `application/json`. The `secret` field is a shared key known to both peers — it is never stored beyond the TTL and is deleted from cache on retrieval of an answer.

### `POST /rtc/get-answer`

Retrieve a pending SDP answer by secret. This endpoint also allows the caller to update their offer with each poll. **The answer is deleted from cache after retrieval.**

**Request body:**
```json
{
  "secret": "your-shared-secret",
  "offer": "[sdp string]"
}
```

**Response:** `200 OK` with the original answer body, or `404` if not found.

---

### `POST /rtc/get-offer`

Retrieve a pending SDP offer by secret.

**Request body:**
```json
{
  "secret": "your-shared-secret"
}
```

**Response:** `200 OK` with the original offer body, or `404` if not found.

---

### `POST /rtc/submit-answer`

Submit an SDP answer. The answer is cached for **1 minute**.

**Request body:**
```json
{
  "secret": "your-shared-secret",
  "sdp": "...",
  ...
}
```

**Response:** `200 OK`

---

## Rate Limiting

| Endpoint group              | Window  | Max requests |
|-----------------------------|---------|--------------|
| `/get-offer`, `/get-answer` | 1s      | 3            |
| `/submit-answer`            | 1s      | 3            |

Rate limit headers are returned with every response (`RateLimit-*`). Exceeded limits return `429 Too Many Requests`.

The server trusts the `X-Forwarded-For` header (`trust proxy 1`), so it works correctly behind a reverse proxy or load balancer.

---

## Getting Started

### Prerequisites

- Node.js 16+
- npm

### Installation

```bash
git clone https://github.com/l3utterfly/Layla-signalling.git
cd Layla-signalling
npm install
```

### Running

```bash
# Development
node server.js

# Custom port
PORT=8080 node server.js
```

The server listens on port `3000` by default.

---

## Deployment

This server is stateless beyond its in-memory cache, so it deploys easily to any Node-compatible host.

> ⚠️ **Note:** Because the cache is in-memory, offers and answers are lost on restart and are not shared across multiple instances. For multi-instance deployments, replace `node-cache` with a shared store such as Redis.

### Render / Railway / Fly.io

Set the `PORT` environment variable if required by your platform — the server picks it up automatically.

### Behind a Reverse Proxy (nginx, Caddy, etc.)

The server is already configured with `trust proxy 1`. No additional changes are needed as long as your proxy forwards `X-Forwarded-For`.

---

## Dependencies

| Package | Purpose |
|---|---|
| [`express`](https://expressjs.com/) | HTTP server framework |
| [`node-cache`](https://github.com/node-cache/node-cache) | In-memory TTL cache |
| [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) | Per-IP rate limiting |

---

## Security Considerations

- **Secrets are not validated** — use sufficiently random secrets (e.g. a UUID or 128-bit random hex) to prevent enumeration.
- **No authentication** — No authentication is included by design; the shared secret provides implicit access control.
- **HTTPS** — always run behind TLS in production. The server itself does not handle TLS termination.

---

## License

MIT