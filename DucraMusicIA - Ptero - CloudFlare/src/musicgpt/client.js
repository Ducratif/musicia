const { ConversionTypes } = require('./conversionTypes');

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '');
}

class MusicGPTClient {
  constructor({ apiKey, baseUrl }) {
    this.apiKey = apiKey;
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  headers(extra = {}) {
    return {
      Authorization: this.apiKey,
      ...extra,
    };
  }

  async jsonRequest(path, bodyObj) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(bodyObj),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: res.status, ok: res.ok, json };
  }

  async formRequest(path, fields) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null || v === '') continue;
      fd.append(k, String(v));
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: fd,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: res.status, ok: res.ok, json };
  }

  async getById({ conversionType, task_id, conversion_id }) {
    const qs = new URLSearchParams();
    qs.set('conversionType', conversionType);
    if (task_id) qs.set('task_id', task_id);
    if (conversion_id) qs.set('conversion_id', conversion_id);

    const res = await fetch(`${this.baseUrl}/byId?${qs.toString()}`, {
      method: 'GET',
      headers: this.headers(),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: res.status, ok: res.ok, json };
  }

  musicAI(payload) { return this.jsonRequest('/MusicAI', payload); }
  textToSpeech(payload) { return this.jsonRequest('/TextToSpeech', payload); }
  promptToLyrics(params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, String(v));
    }
    return fetch(`${this.baseUrl}/prompt_to_lyrics?${qs.toString()}`, {
      method: 'GET',
      headers: this.headers(),
    }).then(async (res) => {
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      return { status: res.status, ok: res.ok, json };
    });
  }

  getAllVoices({ limit = 20, page = 0 } = {}) {
    const qs = new URLSearchParams({ limit: String(limit), page: String(page) });
    return fetch(`${this.baseUrl}/getAllVoices?${qs}`, { method: 'GET', headers: this.headers() })
      .then(async (res) => ({ status: res.status, ok: res.ok, json: await res.json().catch(() => ({})) }));
  }

  searchVoices({ query, limit = 20, page = 0 } = {}) {
    const qs = new URLSearchParams({ query: String(query), limit: String(limit), page: String(page) });
    return fetch(`${this.baseUrl}/searchVoices?${qs}`, { method: 'GET', headers: this.headers() })
      .then(async (res) => ({ status: res.status, ok: res.ok, json: await res.json().catch(() => ({})) }));
  }

  cover(fields) { return this.formRequest('/Cover', fields); }
  voiceChanger(fields) { return this.formRequest('/VoiceChanger', fields); }
  soundGenerator(fields) { return this.formRequest('/sound_generator', fields); }
  fileConvert(fields) { return this.formRequest('/file_convert', fields); }
  extractKeyBpm(fields) { return this.formRequest('/extract_key_bpm', fields); }
  audioToMidi(fields) { return this.formRequest('/audio_to_midi', fields); }
}

module.exports = { MusicGPTClient, ConversionTypes };
