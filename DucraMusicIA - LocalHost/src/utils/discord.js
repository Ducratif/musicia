const { EmbedBuilder } = require('discord.js');

function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0xff4d4d);
}

function okEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x32cd32);
}

function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x4da6ff);
}

function fmtApiError(status, json) {
  if (status === 402) return "Code 402 Ducratif. (Crédits insuffisants sur MusicGPT)";
  const msg = (json && (json.error || json.message)) ? (json.error || json.message) : (json ? JSON.stringify(json).slice(0, 800) : 'Unknown error');
  return `HTTP ${status} — ${msg}`;
}

module.exports = { errorEmbed, okEmbed, infoEmbed, fmtApiError };
