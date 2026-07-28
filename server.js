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

  // Dynamic route: /status/:code -- can't live in the lookup table, has to be checked manually
  if (req.method === 'GET' && req.url.startsWith('/status/')) {
    const parts = req.url.split('/'); // e.g. "/status/404" -> ['', 'status', '404']
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