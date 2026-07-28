const http = require('http');

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

// A small mock dataset to paginate over
const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

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

const server = http.createServer((req, res) => {
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
  // NEW: content negotiation based on the Accept header
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

    // default: JSON
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // NEW: query string parsing
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
});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});