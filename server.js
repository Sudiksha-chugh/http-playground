const http = require('http');

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