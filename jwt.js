const crypto = require('crypto');

const SECRET = 'this-is-a-demo-secret-change-in-real-apps';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));

  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verify(token) {
  const [encodedHeader, encodedPayload, signature] = token.split('.');

  const expectedSignature = crypto
    .createHmac('sha256', SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null; // tampered or invalid
  }

  const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  return JSON.parse(payloadJson);
}

module.exports = { sign, verify };