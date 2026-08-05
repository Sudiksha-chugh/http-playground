const express = require('express');

const app = express();
app.use(express.json()); // middleware: automatically parses JSON bodies into req.body

app.get('/', (req, res) => {
  res.send('Welcome to the homepage!');
});

app.get('/hello', (req, res) => {
  res.send('Hello there!');
});

app.post('/echo', (req, res) => {
  res.json({ youSent: req.body });
});

const STATUS_TEXT = {
  200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request',
  401: 'Unauthorized', 404: 'Not Found', 429: 'Too Many Requests', 500: 'Internal Server Error',
};

app.get('/status/:code', (req, res) => {
  const code = parseInt(req.params.code, 10);

  if (!STATUS_TEXT[code]) {
    return res.status(400).json({ error: 'Unsupported status code', supported: Object.keys(STATUS_TEXT) });
  }

  if (code === 401) res.set('WWW-Authenticate', 'Bearer');
  if (code === 429) res.set('Retry-After', '30');

  res.status(code).json({ status: code, statusText: STATUS_TEXT[code] });
});

const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

app.get('/pagination', (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '5', 10);

  const start = (page - 1) * limit;
  const pageItems = items.slice(start, start + limit);

  res.json({ data: pageItems, meta: { page, limit, total: items.length } });
});

const jwt = require('./jwt');

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'alice' && password === 'wonderland') {
    const token = jwt.sign({ sub: username, role: 'admin' });
    return res.json({ token });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// Middleware: a function that checks auth, then calls next() to continue -- or stops the chain
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  const payload = jwt.verify(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }

  req.user = payload; // attach it, so the actual route handler can use it
  next(); // proceed to the next thing in the chain (the real route handler)
}

app.get('/protected', requireAuth, (req, res) => {
  res.json({ message: `Welcome, ${req.user.sub}!`, yourRole: req.user.role });
});

app.listen(3000, () => {
  console.log('Express server listening on http://localhost:3000');
});