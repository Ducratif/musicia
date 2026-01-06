# 🎶 DucraMusicIA — Discord Bot (MusicGPT)

Un bot Discord **Node.js (discord.js v14)** qui génère de la musique via **MusicGPT / MusicAI** et gère :
- ✅ Slash commands auto (suppression + réinstallation à chaque démarrage)
- ✅ Accès restreint par **rôle Discord**
- ✅ Génération **sans timeout** (defer + polling)
- ✅ Récupération fiable du résultat via **Webhook** (ngrok possible)
- ✅ Backup automatique des fichiers dans `dlmusic/` avant envoi
- ✅ Logs détaillés + mode debug

> Nom du bot : **DucraMusicIA**  
> Présence : **DND** avec rotation “DucraMusicIA” / “Gen MusicIA”

---

## 📦 Prérequis
- Node.js **18+** recommandé (testé sur Node 24 aussi)
- Un bot Discord (token + application)
- Une clé API MusicGPT / MusicAI
- Un serveur Discord (guild) + rôle autorisé

---

## 🚀 Installation
```bash
npm install
cp .env.example .env
npm start
```

Le bot :
1) se connecte,
2) **supprime** les anciennes commandes du serveur,
3) **réinstalle** les slash commands,
4) active présence DND.

---

## 🔧 Configuration (.env)

### Obligatoire
```env
DISCORD_TOKEN=xxxxxxxx
GUILD_ID=123456789012345678
ALLOWED_ROLE_ID=123456789012345678

MUSICGPT_API_KEY=xxxxxxxx
MUSICGPT_BASE_URL=https://api.musicgpt.com/api/public/v1
```

### Limites / Upload / Backup
```env
MAX_UPLOAD_MB=24
DOWNLOAD_DIR=dlmusic
MAX_BACKUP_MB=200
DEBUG=1
```

### Webhook (FORTEMENT recommandé pour MusicAI)
MusicAI peut renvoyer `COMPLETED` via /byId **sans** lien direct.  
Le webhook assure de recevoir **l'URL finale** (souvent signée).

```env
WEBHOOK_PORT=3333
WEBHOOK_PUBLIC_URL=https://xxxx.ngrok-free.dev
WEBHOOK_SECRET=ducratif_secret
```

Le bot expose :
- `POST /webhook/musicgpt?secret=...`

Les payloads webhook sont archivés ici :
- `dlmusic/webhooks/<conversion_id>.json`

---

## 🌐 ngrok (dev / Shadow / machine sans ouverture de ports)

### 1) Lancer le bot
Vérifie que tu vois en console :
- `Webhook server listening on :3333 (/webhook/musicgpt)`

### 2) Lancer ngrok
```bat
ngrok http http://127.0.0.1:3333
```

Tu récupères une URL comme :
- `https://subdomain.ngrok-free.dev`

Tu la mets dans :
```env
WEBHOOK_PUBLIC_URL=https://subdomain.ngrok-free.dev
```

### 3) Test rapide
Dans le navigateur (GET) :
- `https://<ngrok>/webhook/musicgpt?secret=ducratif_secret`

Résultat attendu :
- `Method not allowed` ✅ (normal, c'est POST uniquement)

---

## 🧠 Commandes principales

### 🎶 /musicai
Génère **2 versions** via MusicAI, poll automatiquement, puis :
- récupère l’URL via `/byId` ou **webhook**
- télécharge le fichier dans `dlmusic/`
- attache le fichier si <= `MAX_UPLOAD_MB`, sinon envoie un lien

Options utiles :
- `instrumental: true` (recommandé)
- `private: true` (réponse éphémère)

### 🔎 /status
Vérifie l’état d’une conversion via `/byId`.

### 📚 /voices
Liste/recherche les voix disponibles (si API supportée).

### ℹ️ /about
Infos / crédits / liens.

---

## 🧯 Troubleshooting

### 1) `AccessDenied` sur un lien S3
Normal : certains liens ne sont **pas publics**.  
La bonne méthode = récupérer l’URL finale via **webhook**.

### 2) ngrok 502 / ERR_NGROK_8012
Ça veut dire : rien n’écoute sur `localhost:3333`.  
Vérifie le log “Webhook server listening…”.

### 3) `Required options must be placed before non-required options`
Discord impose : options `required=true` **avant** les `required=false` dans les slash commands.

### 4) `chalk.red is not a function`
Tu es sur chalk v5 (ESM). Fix :
```js
const chalk = require('chalk').default;
```

---

## 🔐 Sécurité
- Ne mets jamais ta clé API / token Discord dans GitHub.
- Le webhook utilise `WEBHOOK_SECRET` pour éviter les posts non désirés.
- Recommande : `private=true` quand tu testes.

---

## 📄 Licence
Usage libre (personnel/projet).  
Crédits : **Ducratif** — 2026-01-05
