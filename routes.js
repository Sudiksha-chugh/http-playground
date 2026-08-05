const crypto = require('crypto');
const jwt = require('./jwt');
const zlib = require('zlib');
crypto.randomUUID()
const STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
const sessions = new Map(); // sessionId -> { username, role }
const idempotencyStore = new Map(); // idempotencyKey -> response body

const routes = {
  'GET /': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Welcome to the homepage!');
  },
  'GET /hello': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello there!');
  },
  'POST /echo': (req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ youSent: body }));
    });
  },
};
const rateLimitBuckets = new Map(); // ip -> { count, windowStart }
const RATE_LIMIT_WINDOW_MS = 30_000; // 30 seconds
const RATE_LIMIT_MAX = 5; // 5 requests per window
function handleRequest(req, res) {
  console.log(req.method, req.url);

  if (req.method === 'GET' && req.url.startsWith('/status/')) {
    const parts = req.url.split('/');
    const code = parseInt(parts[2], 10);

    if (!STATUS_TEXT[code]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unsupported status code', supported: Object.keys(STATUS_TEXT) }));
      return;
    }

    const extraHeaders = {};
    if (code === 401) extraHeaders['WWW-Authenticate'] = 'Bearer';
    if (code === 429) extraHeaders['Retry-After'] = '30';

    res.writeHead(code, { 'Content-Type': 'application/json', ...extraHeaders });
    res.end(JSON.stringify({ status: code, statusText: STATUS_TEXT[code] }));
    return;
  }

  if (req.method === 'GET' && req.url === '/negotiate') {
    const accept = req.headers['accept'] || '';
    const data = { id: 1, name: 'Widget', inStock: true };

    if (accept.includes('application/xml')) {
      const xml = `<item><id>${data.id}</id><name>${data.name}</name><inStock>${data.inStock}</inStock></item>`;
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(xml);
      return;
    }

    if (accept.includes('text/plain')) {
      const text = `id=${data.id} name=${data.name} inStock=${data.inStock}`;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(text);
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }
if (req.method === 'POST' && req.url === '/session-login') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const { username, password } = JSON.parse(body);

      if (username === 'alice' && password === 'wonderland') {
        const sessionId = crypto.randomUUID();
        sessions.set(sessionId, { username, role: 'admin' });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/`,
        });
        res.end(JSON.stringify({ message: 'Logged in via session cookie' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/whoami') {
    const cookies = parseCookies(req);
    const session = sessions.get(cookies.sessionId);

    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No valid session' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `You are ${session.username}`, role: session.role }));
    return;
  }
  if (req.method === 'GET' && req.url === '/limited') {
    const ip = req.socket.remoteAddress;
    const now = Date.now();

    let bucket = rateLimitBuckets.get(ip);

    if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
      bucket = { count: 0, windowStart: now };
      rateLimitBuckets.set(ip, bucket);
    }

    bucket.count += 1;

    if (bucket.count > RATE_LIMIT_MAX) {
      const retryAfterSeconds = Math.ceil((bucket.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      });
      res.end(JSON.stringify({ error: 'Too many requests', retryAfterSeconds }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `Request ${bucket.count} of ${RATE_LIMIT_MAX} allowed this window` }));
    return;
  }
  if (req.method === 'POST' && req.url === '/pay') {
    const idempotencyKey = req.headers['idempotency-key'];

    if (!idempotencyKey) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing Idempotency-Key header' }));
      return;
    }

    if (idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey);
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Replay': 'true' });
      res.end(JSON.stringify(cached));
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const { amount } = JSON.parse(body);
      const paymentId = crypto.randomUUID();
      const result = { paymentId, amount, status: 'charged' };

      idempotencyStore.set(idempotencyKey, result);

      res.writeHead(201, { 'Content-Type': 'application/json', 'X-Replay': 'false' });
      res.end(JSON.stringify(result));
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/old-page') {
    res.writeHead(301, { 'Location': '/new-page' });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/new-page') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('You made it to the new page!');
    return;
  }

  if (req.method === 'GET' && req.url === '/maybe-later') {
    res.writeHead(302, { 'Location': '/new-page' });
    res.end();
    return;
  }
  if (req.method === 'GET' && req.url === '/big-data') {
    // Repeated data compresses very well -- good for demonstrating the size difference
    const payload = JSON.stringify({
      message: 'This is a fairly repetitive payload, on purpose.',
      items: Array.from({ length: 200 }, (_, i) => ({ id: i, note: 'repeated text compresses well' })),
    });

    const acceptEncoding = req.headers['accept-encoding'] || '';

    if (acceptEncoding.includes('gzip')) {
      const compressed = zlib.gzipSync(payload);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Content-Length': compressed.length,
      });
      res.end(compressed);
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      });
      res.end(payload);
    }
    return;
  }
  if (req.method === 'GET' && req.url === '/cors-demo') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // '*' = any website's JS can read this response
    });
    res.end(JSON.stringify({ message: 'If a browser fetched this from another origin, it would be allowed to read it.' }));
    return;
  }
  if (req.method === 'GET' && req.url === '/cached-resource') {
    const resource = { id: 1, title: 'Caching in HTTP', updated: '2026-01-01' };
    const body = JSON.stringify(resource);
    const etag = crypto.createHash('sha1').update(body).digest('hex');

    const clientEtag = req.headers['if-none-match'];

    if (clientEtag === etag) {
      res.writeHead(304, { 'ETag': etag });
      res.end();
      return;
    }
   
    res.writeHead(200, { 'Content-Type': 'application/json', 'ETag': etag });
    res.end(body);
    return;
  }
  if (req.method === 'POST' && req.url === '/login') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const { username, password } = JSON.parse(body);

      // Hardcoded demo user -- in a real app this would check a database
      if (username === 'alice' && password === 'wonderland') {
        const token = jwt.sign({ sub: username, role: 'admin' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/protected') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '');

    const payload = jwt.verify(token);

    if (!payload) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing token' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `Welcome, ${payload.sub}!`, yourRole: payload.role }));
    return;
  }
  
  if (req.method === 'GET' && req.url.startsWith('/pagination')) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '5', 10);

    const start = (page - 1) * limit;
    const pageItems = items.slice(start, start + limit);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: pageItems,
      meta: { page, limit, total: items.length },
    }));
    return;
  }

  const key = `${req.method} ${req.url}`;
  const handler = routes[key];

  if (handler) {
    handler(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}
function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;

  header.split(';').forEach((pair) => {
    const [key, value] = pair.trim().split('=');
    cookies[key] = value;
  });

  return cookies;
}
module.exports = handleRequest;