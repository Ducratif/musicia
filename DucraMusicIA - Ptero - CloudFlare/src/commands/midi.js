const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { fmtApiError, errorEmbed } = require('../utils/discord');
const { ConversionTypes } = require('../musicgpt/conversionTypes');
const { pollUntilDone, headContentLength, fetchBuffer } = require('../utils/http');

function mbToBytes(mb) { return Math.floor(mb * 1024 * 1024); }

async function attachOrLink(url, filename, maxUploadMb) {
  const maxBytes = mbToBytes(maxUploadMb);
  const len = await headContentLength(url);
  if (len !== null && len > maxBytes) return { kind: 'link', url, size: len };
  try {
    const buf = await fetchBuffer(url, maxBytes);
    return { kind: 'file', file: new AttachmentBuilder(buf, { name: filename }), size: buf.length };
  } catch {
    return { kind: 'link', url, size: len };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('midi')
    .setDescription('Audio → MIDI (POST /audio_to_midi)')
    .addAttachmentOption(o => o.setName('audio').setDescription('Fichier audio Discord (optionnel)').setRequired(false))
    .addStringOption(o => o.setName('audio_url').setDescription('URL audio (optionnel)').setRequired(false))
    .addBooleanOption(o => o.setName('sonify_midi').setDescription('Génère un WAV sonifié (default true)').setRequired(false))
    .addBooleanOption(o => o.setName('save_note_events').setDescription('Génère CSV note events (default true)').setRequired(false))
    .addBooleanOption(o => o.setName('private').setDescription('Réponse éphémère').setRequired(false)),
  async execute(interaction, ctx) {
    const audio = interaction.options.getAttachment('audio');
    const audio_url = interaction.options.getString('audio_url') ?? audio?.url ?? '';
    const sonify_midi = interaction.options.getBoolean('sonify_midi');
    const save_note_events = interaction.options.getBoolean('save_note_events');
    const isPrivate = interaction.options.getBoolean('private') ?? false;

    if (!audio_url) {
      return interaction.reply({ embeds: [errorEmbed('Paramètre manquant', 'Fournis `audio_url` ou `audio` (attachment).')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: isPrivate });

    const r = await ctx.api.audioToMidi({
      audio_url,
      sonify_midi: sonify_midi ?? true,
      save_note_events: save_note_events ?? true,
      webhook_url: '',
    });

    if (!r.ok || r.json?.success === false) {
      return interaction.editReply({ embeds: [errorEmbed('API Error', fmtApiError(r.status, r.json))] });
    }

    const task = r.json;
    const maxMs = Math.min(12 * 60 * 1000, 12 * 60 * 1000);

    const done = await pollUntilDone(
      () => ctx.api.getById({ conversionType: ConversionTypes.AUDIO_TO_MIDI, task_id: task.task_id }),
      { intervalMs: 4000, maxMs }
    );

    if (done.timeout) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('Audio→MIDI — Timeout').setDescription(`Utilise \`/status\` type AUDIO_TO_MIDI id \`${task.task_id}\`.`)]
      });
    }

    const conv = done.json?.conversion ?? {};
    const status = String(conv.status ?? '').toUpperCase();
    if (status !== 'COMPLETED') {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('Audio→MIDI — Erreur').setDescription(`Status: \`${conv.status ?? 'N/A'}\`\nMsg: ${conv.status_msg ?? 'N/A'}`)]
      });
    }

    const urls = [
      { key: 'midi_url', url: conv.midi_url, name: 'output.mid' },
      { key: 'audio_url', url: conv.audio_url, name: 'sonified.wav' },
      { key: 'csv_url', url: conv.csv_url, name: 'note_events.csv' },
    ].filter(x => x.url);

    const files = [];
    const lines = [`• **task_id**: \`${task.task_id}\``, `• **status**: \`${conv.status}\``];

    for (const u of urls) {
      const out = await attachOrLink(u.url, u.name, ctx.limits.maxUploadMb);
      if (out.kind === 'file') {
        files.push(out.file);
        lines.push(`• ${u.key}: fichier attaché (${(out.size/1024/1024).toFixed(2)} MB)`);
      } else {
        lines.push(`• ${u.key}: ${out.url}`);
      }
    }

    const e = new EmbedBuilder().setTitle('✅ Audio → MIDI — Résultat').setDescription(lines.join('\n'));
    await interaction.editReply({ embeds: [e], files });
  }
};
