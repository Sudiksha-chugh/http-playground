const http = require('http');
const handleRequest = require('./routes');

const server = http.createServer(handleRequest);

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});