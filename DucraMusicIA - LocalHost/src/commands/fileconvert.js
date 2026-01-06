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
    .setName('fileconvert')
    .setDescription('File Conversion (POST /file_convert)')
    .addStringOption(o => o.setName('target_format').setDescription('Format').setRequired(true).addChoices(
      { name: 'mp3', value: 'mp3' },
      { name: 'wav', value: 'wav' },
      { name: 'flac', value: 'flac' },
      { name: 'ogg', value: 'ogg' },
      { name: 'aac', value: 'aac' },
      { name: 'webm', value: 'webm' }
    ))
    .addAttachmentOption(o => o.setName('audio').setDescription('Fichier audio Discord (optionnel)').setRequired(false))
    .addStringOption(o => o.setName('audio_url').setDescription('URL audio (optionnel)').setRequired(false))
    .addIntegerOption(o => o.setName('target_sr').setDescription('Sample rate (Hz)').setRequired(false))
    .addIntegerOption(o => o.setName('target_bd').setDescription('Bit depth').setRequired(false))
    .addBooleanOption(o => o.setName('private').setDescription('Réponse éphémère').setRequired(false)),

  async execute(interaction, ctx) {
    const audio = interaction.options.getAttachment('audio');
    const audio_url = interaction.options.getString('audio_url') ?? audio?.url ?? '';
    const target_format = interaction.options.getString('target_format', true);
    const target_sr = interaction.options.getInteger('target_sr');
    const target_bd = interaction.options.getInteger('target_bd');
    const isPrivate = interaction.options.getBoolean('private') ?? false;

    if (!audio_url) {
      return interaction.reply({ embeds: [errorEmbed('Paramètre manquant', 'Fournis `audio_url` ou `audio` (attachment).')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: isPrivate });

    const r = await ctx.api.fileConvert({ audio_url, target_format, target_sr, target_bd, webhook_url: '' });
    if (!r.ok || r.json?.success === false) {
      return interaction.editReply({ embeds: [errorEmbed('API Error', fmtApiError(r.status, r.json))] });
    }

    const task = r.json;
    const maxMs = Math.min(10 * 60 * 1000, Math.max(60_000, (Number(task.eta) || 60) * 1000 * 3));

    const done = await pollUntilDone(
      () => ctx.api.getById({ conversionType: ConversionTypes.FILE_CONVERT, task_id: task.task_id }),
      { intervalMs: 4000, maxMs }
    );

    if (done.timeout) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('FileConvert — Timeout').setDescription(`Utilise \`/status\` type FILE_CONVERT id \`${task.task_id}\`.`)]
      });
    }

    const conv = done.json?.conversion ?? {};
    const url = conv.audio_url;
    if (String(conv.status).toUpperCase() !== 'COMPLETED' || !url) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('FileConvert — Erreur').setDescription(`Status: \`${conv.status ?? 'N/A'}\`\nMsg: ${conv.status_msg ?? 'N/A'}`)]
      });
    }

    const out = await attachOrLink(url, `converted.${target_format}`, ctx.limits.maxUploadMb);
    const files = out.kind === 'file' ? [out.file] : [];

    const e = new EmbedBuilder()
      .setTitle('✅ FileConvert — Résultat')
      .setDescription([
        `• **task_id**: \`${task.task_id}\``,
        `• **format**: \`${target_format}\``,
        out.kind === 'link' ? `• lien: ${out.url}` : '• fichier attaché',
      ].join('\n'));

    await interaction.editReply({ embeds: [e], files });
  }
};
