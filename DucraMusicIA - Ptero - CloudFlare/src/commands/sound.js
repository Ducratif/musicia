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
    .setName('sound')
    .setDescription('Sound Generator (POST /sound_generator)')
    .addStringOption(o => o.setName('prompt').setDescription('Prompt (SFX / ambiances)').setRequired(true))
    .addIntegerOption(o => o.setName('audio_length').setDescription('Durée en secondes (ex: 10-60)').setRequired(false))
    .addBooleanOption(o => o.setName('private').setDescription('Réponse éphémère').setRequired(false)),
  async execute(interaction, ctx) {
    const prompt = interaction.options.getString('prompt', true);
    const audio_length = interaction.options.getInteger('audio_length') ?? 30;
    const isPrivate = interaction.options.getBoolean('private') ?? false;

    await interaction.deferReply({ ephemeral: isPrivate });

    const r = await ctx.api.soundGenerator({ prompt, audio_length, webhook_url: '' });
    if (!r.ok || r.json?.success === false) {
      return interaction.editReply({ embeds: [errorEmbed('API Error', fmtApiError(r.status, r.json))] });
    }

    const task = r.json;
    const maxMs = Math.min(10 * 60 * 1000, Math.max(60_000, (Number(task.eta) || 60) * 1000 * 3));

    const done = await pollUntilDone(
      () => ctx.api.getById({ conversionType: ConversionTypes.SOUND_GENERATOR, task_id: task.task_id }),
      { intervalMs: 4000, maxMs }
    );

    if (done.timeout) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('Sound Generator — Timeout').setDescription(`Utilise \`/status\` type SOUND_GENERATOR id \`${task.task_id}\`.`)]
      });
    }

    const conv = done.json?.conversion ?? {};
    const url = conv.audio_url;
    if (String(conv.status).toUpperCase() !== 'COMPLETED' || !url) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('Sound Generator — Erreur').setDescription(`Status: \`${conv.status ?? 'N/A'}\`\nMsg: ${conv.status_msg ?? 'N/A'}`)]
      });
    }

    const out = await attachOrLink(url, 'sound.mp3', ctx.limits.maxUploadMb);
    const files = out.kind === 'file' ? [out.file] : [];

    const e = new EmbedBuilder()
      .setTitle('✅ Sound Generator — Résultat')
      .setDescription([
        `• **task_id**: \`${task.task_id}\``,
        out.kind === 'link' ? `• lien: ${out.url}` : '• fichier attaché',
      ].join('\n'));

    await interaction.editReply({ embeds: [e], files });
  }
};
