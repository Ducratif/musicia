const assert = require('node:assert');

function toBool(name, fallback = false) {
  const v = getEnv(name);
  if (!v) return fallback;
  return ['1','true','yes','on'].includes(String(v).toLowerCase());
}


function getEnv(name, fallback = undefined) {
  const v = process.env[name];
  return (v === undefined || v === '') ? fallback : v;
}

function must(name) {
  const v = getEnv(name);
  assert(v, `Missing env var: ${name}`);
  return v;
}

function toInt(name, fallback) {
  const v = getEnv(name);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(name, fallback) {
  const v = getEnv(name);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  discord: {
    token: must('DISCORD_TOKEN'),
    clientId: must('CLIENT_ID'),
    guildId: must('GUILD_ID'),
    allowedRoleId: must('ALLOWED_ROLE_ID'),
  },
  musicgpt: {
    apiKey: must('MUSICGPT_API_KEY'),
    baseUrl: getEnv('MUSICGPT_BASE_URL', 'https://api.musicgpt.com/api/public/v1'),
  },
  presence: {
    status: getEnv('PRESENCE_STATUS', 'dnd'),
    rotateSeconds: toInt('PRESENCE_ROTATE_SECONDS', 20),
    text1: getEnv('PRESENCE_1', 'DucraMusicIA'),
    text2: getEnv('PRESENCE_2', 'Gen MusicIA'),
  },
  limits: {
    maxUploadMb: toFloat('MAX_UPLOAD_MB', 23),
  },
  credits: {
    name: getEnv('CREDITS_NAME', 'Ducratif'),
    tagline: getEnv('CREDITS_TAGLINE', 'Developed by Ducratif'),
    website: getEnv('CREDITS_WEBSITE', 'https://musicgpt.com/'),
    docs: getEnv('CREDITS_DOCS', 'https://docs.musicgpt.com/'),
    github: getEnv('CREDITS_GITHUB', ''),
    discord: getEnv('CREDITS_DISCORD', ''),
  },
  debug: toBool('DEBUG', false),
    downloads: {
      dir: getEnv('DOWNLOAD_DIR', 'dlmusic'),
      maxBackupMb: toFloat('MAX_BACKUP_MB', 200),
  },
  webhook: {
    enabled: !!getEnv('WEBHOOK_PUBLIC_URL') && !!getEnv('WEBHOOK_SECRET'),
    publicUrl: getEnv('WEBHOOK_PUBLIC_URL', ''),
    port: Number(getEnv('WEBHOOK_PORT', '3333')),
    secret: getEnv('WEBHOOK_SECRET', ''),
  },


};

module.exports = { config, getEnv };
