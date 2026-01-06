const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://musicgpt.com/',
};


function mbToBytes(mb) {
  return Math.floor(Number(mb) * 1024 * 1024);
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function safeName(s) {
  return String(s).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 180);
}

async function headLength(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', headers: DEFAULT_HEADERS, redirect: 'follow' });
    if (!r.ok) return { len: null, status: r.status };
    const len = r.headers.get('content-length');
    return { len: len ? Number(len) : null, status: r.status };
  } catch {
    return { len: null, status: null };
  }
}

async function downloadToFile(url, outPath, { timeoutMs = 120000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: ctrl.signal,
      redirect: 'follow',
    });

    if (!r.ok) throw new Error(`Download failed: HTTP ${r.status}`);

    const nodeStream = Readable.fromWeb(r.body);
    await pipeline(nodeStream, fs.createWriteStream(outPath));
  } finally {
    clearTimeout(t);
  }
}

async function backupAndGetAttachment(url, {
  dir,
  baseName,
  maxUploadMb,
  maxBackupMb,
  log,
  debug,
}) {
  const absDir = path.resolve(process.cwd(), dir);
  await ensureDir(absDir);

  const head = await headLength(url);
    const size = head.len;
    
    if (debug) log.debug(`[DL] HEAD status=${head.status ?? 'n/a'} size=${size ?? 'unknown'} url=${url}`);

  const maxBackupBytes = mbToBytes(maxBackupMb);

  if (debug) log.debug(`[DL] HEAD size=${size ?? 'unknown'} url=${url}`);

  if (size !== null && size > maxBackupBytes) {
    if (debug) log.warn(`[DL] Skip backup (>${maxBackupMb}MB). Sending link only.`);
    return { kind: 'link', url, size };
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${safeName(baseName)}_${stamp}.mp3`;
  const filePath = path.join(absDir, filename);

  if (debug) log.debug(`[DL] Downloading -> ${filePath}`);

  await downloadToFile(url, filePath);

  const st = await fsp.stat(filePath);
  const maxUploadBytes = mbToBytes(maxUploadMb);

  if (debug) log.debug(`[DL] Saved size=${st.size} bytes (${(st.size/1024/1024).toFixed(2)}MB)`);

  if (st.size > maxUploadBytes) {
    if (debug) log.warn(`[DL] Too big for Discord upload (>${maxUploadMb}MB). Link only, but backup kept.`);
    return { kind: 'link', url, size: st.size, filePath };
  }

  return { kind: 'file', filePath, size: st.size };
}

module.exports = { backupAndGetAttachment };