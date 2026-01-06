const http = require('node:http');
const { URL } = require('node:url');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function startWebhookServer({ port, secret, onPayload, log, debug }) {
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, `http://${req.headers.host}`);
      if (u.pathname !== '/webhook/musicgpt') {
        res.writeHead(404); return res.end('Not found');
      }
      if (u.searchParams.get('secret') !== secret) {
        res.writeHead(401); return res.end('Unauthorized');
      }
      if (req.method !== 'POST') {
        res.writeHead(405); return res.end('Method not allowed');
      }

      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');

      if (debug) log.debug(`[webhook] received: conversion_id=${payload.conversion_id ?? 'N/A'} task_id=${payload.task_id ?? 'N/A'}`);
      await onPayload(payload);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      log.error(`[webhook] error: ${e?.message || e}`);
      res.writeHead(400); res.end('Bad request');
    }
  });

  server.listen(port, () => log.ok(`Webhook server listening on :${port} (/webhook/musicgpt)`));
  return server;
}

module.exports = { startWebhookServer };
