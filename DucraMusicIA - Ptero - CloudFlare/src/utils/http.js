const { setTimeout: sleep } = require('node:timers/promises');

async function headContentLength(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return null;
    const len = res.headers.get('content-length');
    return len ? Number(len) : null;
  } catch {
    return null;
  }
}

async function fetchBuffer(url, maxBytes) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);
    if (maxBytes && buf.length > maxBytes) {
      throw new Error(`File too large (${buf.length} bytes)`);
    }
    return buf;
  } finally {
    clearTimeout(timeout);
  }
}

async function pollUntilDone(fnCheck, {
  intervalMs = 5000,
  maxMs = 12 * 60 * 1000, // 12 minutes
  onTick = null,
} = {}) {
  const started = Date.now();
  let tick = 0;
  while (true) {
    const r = await fnCheck();
    tick += 1;
    if (onTick) await onTick(r, tick, Date.now() - started);

    const status = r?.json?.conversion?.status || r?.json?.status;
    if (status && ['COMPLETED', 'FAILED', 'ERROR', 'CANCELED'].includes(String(status).toUpperCase())) {
      return r;
    }
    if (Date.now() - started > maxMs) {
      return { timeout: true, last: r };
    }
    await sleep(intervalMs);
  }
}

module.exports = { headContentLength, fetchBuffer, pollUntilDone };
