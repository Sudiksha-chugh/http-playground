# HTTP Concepts Playground

A hand-built Node.js server (zero npm dependencies) demonstrating core HTTP concepts. Built from scratch, one concept at a time, using only Node's built-in modules (`http`, `crypto`, `zlib`).

## Setup

```bash
npm install   # no-op, zero dependencies, but keeps the workflow standard
npm run dev   # starts the server with auto-restart on file changes
```

Server runs at `http://localhost:3000`.

## Endpoints

### Basic routing
- `GET /` — homepage
- `GET /hello` — simple text response
- `POST /echo` — echoes back whatever body you send

### Status codes
- `GET /status/:code` — returns any of 200, 201, 204, 400, 401, 404, 429, 500 with appropriate headers (e.g. `WWW-Authenticate` on 401, `Retry-After` on 429)

### Content negotiation
- `GET /negotiate` — responds in JSON, XML, or plain text depending on the `Accept` header

### Caching
- `GET /cached-resource` — supports `If-None-Match` for conditional requests, returns `304 Not Modified` when the ETag matches

### Pagination
- `GET /pagination?page=1&limit=5` — offset-based pagination over a mock dataset

### Auth — JWT (stateless)
- `POST /login` — body `{"username":"alice","password":"wonderland"}`, returns a signed JWT
- `GET /protected` — requires `Authorization: Bearer <token>`

### Auth — Cookie sessions (stateful)
- `POST /session-login` — same credentials, sets an `HttpOnly` session cookie
- `GET /whoami` — requires the session cookie, looks up the session server-side

### Rate limiting
- `GET /limited` — max 5 requests per 30-second window per IP, then `429` with `Retry-After`

### Idempotency
- `POST /pay` — requires `Idempotency-Key` header; body `{"amount": 100}`. Same key returns the same cached result (`X-Replay: true`) instead of double-processing

### Redirects
- `GET /old-page` — `301` permanent redirect to `/new-page`
- `GET /maybe-later` — `302` temporary redirect to `/new-page`

### Compression
- `GET /big-data` — gzips the response when `Accept-Encoding: gzip` is sent

### CORS
- `GET /cors-demo` — sends `Access-Control-Allow-Origin: *` (note: CORS is browser-enforced, curl/Postman won't block anything — this just shows the header)

### Server-Sent Events
- `GET /live-updates` — streams 5 events, one per second, over a single open connection

### File uploads
- `POST /upload` — hand-written `multipart/form-data` parser; send a `note` text field and a `file` field

## Concepts demonstrated
HTTP methods & idempotency, status code families, headers, query strings, content negotiation, conditional caching (ETag/304), JWT vs session auth, rate limiting, idempotency keys, redirects (301/302), gzip compression, CORS, SSE streaming, multipart parsing.