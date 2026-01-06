const fs = require('node:fs/promises');
const path = require('node:path');

const store = {
  byConversionId: new Map(),
  byTaskId: new Map(),
};

async function savePayload(downloadDir, payload) {
  try {
    const dir = path.join(process.cwd(), downloadDir, 'webhooks');
    await fs.mkdir(dir, { recursive: true });
    const id = payload.conversion_id || payload.task_id || `payload_${Date.now()}`;
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(payload, null, 2), 'utf8');
  } catch {}
}

function put(payload) {
  if (payload?.conversion_id) store.byConversionId.set(payload.conversion_id, payload);
  if (payload?.task_id) store.byTaskId.set(payload.task_id, payload);
}

function getByConversionId(id) { return store.byConversionId.get(id); }
function getByTaskId(id) { return store.byTaskId.get(id); }

module.exports = { store, put, getByConversionId, getByTaskId, savePayload };
