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

app.listen(3000, () => {
  console.log('Express server listening on http://localhost:3000');
});