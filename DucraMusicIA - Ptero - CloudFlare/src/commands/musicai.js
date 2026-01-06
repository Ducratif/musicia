const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { fmtApiError, errorEmbed } = require('../utils/discord');
const { ConversionTypes } = require('../musicgpt/conversionTypes');
const { pollUntilDone } = require('../utils/http');
const { backupAndGetAttachment } = require('../utils/downloads');
const path = require('node:path');
const { getByConversionId } = require('../webhook/store');


function buildQueuedEmbed(task, eta) {
  return new EmbedBuilder()
    .setTitle('🎶 MusicAI — Génération en cours')
    .setDescription([
      'La requête est partie chez MusicGPT.',
      `• **task_id**: \`${task.task_id}\``,
      task.conversion_id_1 ? `• **conversion_1**: \`${task.conversion_id_1}\`` : null,
      task.conversion_id_2 ? `• **conversion_2**: \`${task.conversion_id_2}\`` : null,
      eta !== undefined ? `• **ETA (sec)**: ${eta}` : null,
      '',
      '_Je poll l’API automatiquement pour éviter le timeout Discord._'
    ].filter(Boolean).join('\n'));
}

async function waitConversion(ctx, conversion_id, conversionType, maxMs) {
  return pollUntilDone(
    () => ctx.api.getById({ conversionType, conversion_id }),
    { intervalMs: 5000, maxMs }
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('musicai')
    .setDescription('Génère une musique via POST /MusicAI (2 versions)')
    .addStringOption(o => o.setName('prompt').setDescription('Prompt (idée/vibe) - conseillé < 280 chars').setRequired(true))
    .addStringOption(o => o.setName('music_style').setDescription('Style (ex: Pop, Rock, Drill, Lo-Fi)').setRequired(false))
    .addStringOption(o => o.setName('lyrics').setDescription('Lyrics (optionnel)').setRequired(false))
    .addBooleanOption(o => o.setName('instrumental').setDescription('Instrumental only').setRequired(false))
    .addBooleanOption(o => o.setName('vocal_only').setDescription('Vocal only').setRequired(false))
    .addStringOption(o => o.setName('voice_id').setDescription('Voice ID (optionnel)').setRequired(false))
    .addBooleanOption(o => o.setName('private').setDescription('Réponse éphémère').setRequired(false)),

  async execute(interaction, ctx) {
    const prompt = interaction.options.getString('prompt', true);
    const music_style = interaction.options.getString('music_style') ?? '';
    const lyrics = interaction.options.getString('lyrics') ?? '';
    const make_instrumental = interaction.options.getBoolean('instrumental') ?? false;
    const vocal_only = interaction.options.getBoolean('vocal_only') ?? false;
    const voice_id = interaction.options.getString('voice_id') ?? '';
    const isPrivate = interaction.options.getBoolean('private') ?? false;

    await interaction.deferReply({ ephemeral: isPrivate });

    const payload = {
      prompt,
      music_style,
      lyrics,
      make_instrumental,
      vocal_only,
      voice_id,
      webhook_url: ctx.config.webhook.enabled
        ? `${ctx.config.webhook.publicUrl}/webhook/musicgpt?secret=${encodeURIComponent(ctx.config.webhook.secret)}`
        : ''

    };

    if (ctx.debug) ctx.log.debug(`[musicai] payload: ${JSON.stringify({ ...payload, lyrics: lyrics ? '[lyrics]' : '' })}`);

    const r = await ctx.api.musicAI(payload);
    if (!r.ok || r.json?.success === false) {
      return interaction.editReply({ embeds: [errorEmbed('API Error', fmtApiError(r.status, r.json))] });
    }

    const task = r.json;
    if (ctx.debug) ctx.log.debug(`[musicai] queued task_id=${task.task_id} eta=${task.eta} c1=${task.conversion_id_1} c2=${task.conversion_id_2}`);

    await interaction.editReply({ embeds: [buildQueuedEmbed(task, task.eta)] });

    const maxMs = Math.min(15 * 60 * 1000, Math.max(60_000, (Number(task.eta) || 120) * 1000 * 3));
    const ids = [task.conversion_id_1, task.conversion_id_2].filter(Boolean);

    const results = [];

    if (ids.length) {
      for (const [i, cid] of ids.entries()) {
        const done = await waitConversion(ctx, cid, ConversionTypes.MUSIC_AI, maxMs);
        results.push({ idx: i + 1, cid, done });
      }
    } else if (task.task_id) {
      const done = await pollUntilDone(
        () => ctx.api.getById({ conversionType: ConversionTypes.MUSIC_AI, task_id: task.task_id }),
        { intervalMs: 5000, maxMs }
      );
      results.push({ idx: 1, cid: null, done });
    }

    const files = [];
    const lines = [];

    for (const r0 of results) {
      const conv = r0.done?.json?.conversion ?? r0.done?.last?.json?.conversion ?? r0.done?.json ?? {};
      const status = conv.status ?? (r0.done?.timeout ? 'TIMEOUT' : 'UNKNOWN');

      const conversionId = r0.cid || conv.conversion_id || null;

      let url =
        conv.audio_url ||
        conv.conversion_path ||
        conv.conversion_path_mp3 ||
        conv.conversion_path_wav ||
        null;
          
      if (!url && conversionId) {
        const wh = getByConversionId(conversionId);
        if (wh) {
          url =
            wh.audio_url ||
            wh.conversion_path ||
            wh.conversion_path_mp3 ||
            wh.conversion_path_wav ||
            null;
        
          if (ctx.debug) ctx.log.debug(`[musicai] v${r0.idx} webhook HIT ${conversionId} -> url=${url ?? 'N/A'}`);
        } else {
          if (ctx.debug) ctx.log.debug(`[musicai] v${r0.idx} webhook MISS ${conversionId}`);
        }
      }


      lines.push(`**Version ${r0.idx}** — status: \`${status}\`${conversionId ? ` — id: \`${conversionId}\`` : ''}`);

      if (ctx.debug) {
        ctx.log.debug(`[musicai] v${r0.idx} status=${status} conversionId=${conversionId ?? 'N/A'} url=${url ?? 'N/A'}`);
      }

      if (url && String(status).toUpperCase() === 'COMPLETED') {
        let out;
        try {
          out = await backupAndGetAttachment(url, {
            dir: ctx.downloads?.dir ?? 'dlmusic',
            baseName: `musicai_v${r0.idx}_${conversionId ?? 'unknown'}`,
            maxUploadMb: ctx.limits.maxUploadMb,
            maxBackupMb: ctx.downloads?.maxBackupMb ?? 200,
            log: ctx.log,
            debug: ctx.debug,
          });
        } catch (err) {
          ctx.log.error(`[DL] Backup failed for v${r0.idx}: ${err?.message || err}`);
          lines.push(`• ⚠️ download failed: \`${err?.message || 'unknown error'}\``);
          lines.push(`• lien: ${url}`);
          lines.push('');
          continue;
        }


        if (out.kind === 'file') {
          files.push(new AttachmentBuilder(out.filePath));
          lines.push(`• sauvegardé: \`${path.relative(process.cwd(), out.filePath)}\``);
          lines.push(`• fichier attaché (${(out.size / 1024 / 1024).toFixed(2)} MB)`);
        } else {
          if (out.filePath) {
            lines.push(`• sauvegardé: \`${path.relative(process.cwd(), out.filePath)}\``);
          }
          lines.push(`• lien: ${out.url}${out.size ? ` (${(out.size / 1024 / 1024).toFixed(2)} MB)` : ''}`);
        }

      } else if (r0.done?.timeout) {
        lines.push('• ⚠️ Timeout côté bot (conversion trop longue). Utilise `/status` avec le même ID pour récupérer plus tard.');
      } else {
        lines.push(`• msg: ${conv.status_msg ?? 'N/A'}`);
      }

      lines.push('');
    }

    const e = new EmbedBuilder()
      .setTitle('✅ MusicAI — Résultat')
      .setDescription(lines.join('\n'));

    await interaction.editReply({ embeds: [e], files });
  }
};