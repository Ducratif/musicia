# 🎵 DucraMusicIA — Discord Bot (MusicGPT AI)

> **DucraMusicIA** est un bot Discord Node.js qui génère des musiques (et conversions audio) via l’API **MusicGPT**.  
> Il gère **les slash commands**, **les permissions par rôle**, un **webhook public** (Cloudflare Tunnel / ngrok) pour récupérer les liens de sortie, et sauvegarde automatiquement les fichiers dans `dlmusic/`.

---

## ✨ Features

- ✅ Statut : **DND**
- ✅ Présence : **DucraMusicIA** + **Gen MusicIA**
- ✅ Slash commands : installées **à chaque démarrage** (suppression des anciennes → réinstallation)
- ✅ Accès restreint : **role ID** obligatoire (anti-abus)
- ✅ Génération MusicAI (2 versions) + polling / status
- ✅ Webhook optionnel : récupère l’URL finale de sortie (MP3, WAV, etc.)
- ✅ Backup : télécharge et sauvegarde les fichiers dans `dlmusic/` avant envoi
- ✅ Logs détaillés (debug) : console + journaux de download/webhook

---

## 🧱 Prérequis

- Node.js (recommandé **20+**)
- Un bot Discord + token
- Un serveur Discord (Guild) + ID de serveur
- Un rôle autorisé (Allowed Role ID)
- Une clé API MusicGPT
- (Optionnel mais recommandé) Un endpoint public **Cloudflare Tunnel** ou **ngrok** pour le webhook

---

## 📦 Installation (Localhost)

```bash
git clone <ton-repo>
cd DucraMusicIA
npm install
cp .env.example .env
npm start
```

---

## 🔑 Configuration `.env`

> Tous les secrets vont dans `.env`. Ne commit jamais ce fichier.

```env
# Discord
DISCORD_TOKEN=xxxxxxxx
GUILD_ID=123456789012345678
ALLOWED_ROLE_ID=123456789012345678

# MusicGPT
MUSICGPT_API_KEY=xxxxxxxx
MUSICGPT_BASE_URL=https://api.musicgpt.com/api/public/v1

# Debug
DEBUG_LOGS=true

# Webhook (recommandé)
WEBHOOK_ENABLED=true
WEBHOOK_PORT=31009
WEBHOOK_PUBLIC_URL=https://musicia.ducratif.com
WEBHOOK_SECRET=change_me_long_random

# Limits
MAX_UPLOAD_MB=23
MAX_BACKUP_MB=200
```

### À quoi ça sert ?
- `WEBHOOK_ENABLED=true` : injecte `webhook_url` dans les requêtes MusicGPT.
- `WEBHOOK_PORT` : port HTTP du mini serveur webhook (dans le bot).
- `WEBHOOK_PUBLIC_URL` : URL publique de ton webhook (Cloudflare Tunnel ou ngrok).
- `WEBHOOK_SECRET` : sécurité (querystring `?secret=...`) pour bloquer les appels non autorisés.
- `MAX_UPLOAD_MB` : taille max pour **attacher** un fichier sur Discord (sinon lien).
- `MAX_BACKUP_MB` : taille max autorisée pour **sauvegarder** dans `dlmusic/`.

---

## 🤖 Commandes

### `/musicai`
Génère une musique (2 versions) via `POST /MusicAI`.

Options :
- `prompt` (obligatoire)
- `music_style` (optionnel)
- `lyrics` (optionnel)
- `instrumental` (bool)
- `vocal_only` (bool)
- `voice_id` (optionnel)
- `private` (réponse éphémère)

### `/status`
Check le statut d’une conversion via `GET /byId`  
(avec `task_id` ou `conversion_id`).

---

## 🧠 Comment fonctionne le webhook ?

**Problème** : certaines URLs renvoyées par polling/“fallback” peuvent être temporaires / protégées (403).  
**Solution** : MusicGPT envoie la vraie sortie au **webhook_url** quand c’est prêt.

Le bot expose :
- `POST /webhook/musicgpt?secret=XXXX`

Le bot :
1. Vérifie le `secret`
2. Log et sauvegarde la payload JSON dans `dlmusic/webhooks/`
3. Associe `conversion_id` → `conversion_path`
4. Lors de la fin de `/musicai`, le bot récupère le lien final depuis le store webhook et télécharge/attache.

---

# 🚀 Déploiement Pterodactyl + Cloudflare Tunnel (PROD)

## 0) Concepts importants

- Ton bot tourne dans un **container** Pterodactyl.
- Le port webhook est exposé via Docker (souvent sur `172.18.0.1:<PORT>`).
- Cloudflare Tunnel (cloudflared) tourne sur le **node** et “route” le hostname vers **l’IP/port joignables depuis le node**.

---

## 1) Pterodactyl — Créer le serveur + allocation

1. Crée un serveur Pterodactyl Node.js
2. Ajoute une allocation pour le port webhook (ex: `31009`)
3. Dans ton bot : `WEBHOOK_PORT=31009`
4. Le serveur webhook doit écouter en **0.0.0.0** dans le container (important)

✅ Log attendu : `Webhook server listening on :31009 (/webhook/musicgpt)`

---

## 2) Cloudflare — DNS record pour le Tunnel

Dans Cloudflare DNS :

- **Type** : `CNAME`
- **Name** : `musicia`
- **Target** : `<TUNNEL_UUID>.cfargotunnel.com`
- Proxy : ✅ ON (nuage orange)

⚠️ Le suffixe `.cfargotunnel.com` est obligatoire.

---

## 3) Cloudflared — Ingress rule sur le node

Fichier : `/etc/cloudflared/config.yml`

Ajoute (avant le `http_status:404`) :

```yaml
  - hostname: musicia.ducratif.com
    service: http://172.18.0.1:31009
```

### Pourquoi `172.18.0.1` ?
Vérifie sur le node :

```bash
sudo ss -lntp | grep 31009
# LISTEN ... 172.18.0.1:31009 users:(("docker-proxy",...))
```

➡️ Si tu mets `127.0.0.1:31009`, tu peux avoir **connection refused**.

Redémarre cloudflared :

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager
```

---

## 4) Tests (obligatoires)

### A) Test local (sur le node)
```bash
curl -i http://172.18.0.1:31009/webhook/musicgpt?secret=TON_SECRET
```
✅ attendu : `405 Method Not Allowed`

### B) Test via le domaine
```bash
curl -i https://musicia.ducratif.com/webhook/musicgpt?secret=TON_SECRET
```
✅ attendu : `405 Method Not Allowed`

### C) Test POST (Windows PowerShell)
```powershell
Invoke-RestMethod -Method POST `
  -Uri "https://musicia.ducratif.com/webhook/musicgpt?secret=TON_SECRET" `
  -ContentType "application/json" `
  -Body '{"conversion_id":"test","task_id":"test","conversion_path":"https://example.com/test.mp3"}'
```

✅ attendu : `{"ok":true}`  
Et un JSON dans `dlmusic/webhooks/` + log côté bot.

---

## 5) Webhook URL envoyée à MusicGPT

Le bot doit envoyer :

```
https://musicia.ducratif.com/webhook/musicgpt?secret=TON_SECRET
```

Donc ton `.env` doit contenir :

```env
WEBHOOK_PUBLIC_URL=https://musicia.ducratif.com
WEBHOOK_SECRET=TON_SECRET
WEBHOOK_ENABLED=true
```

---

# 🧰 Troubleshooting

## Cloudflare 1016
➡️ DNS mauvais : le CNAME doit viser `<UUID>.cfargotunnel.com`.

## Cloudflare 502
➡️ cloudflared ne reach pas l’origine.

```bash
sudo journalctl -u cloudflared -n 50 --no-pager
```

Cas fréquent : cloudflared pointe `127.0.0.1:PORT` alors que l’écoute est sur `172.18.0.1:PORT`.

## `curl 127.0.0.1:PORT` refuse
Normal si le port est bind sur `172.18.0.1`.  
Teste plutôt `http://172.18.0.1:PORT`.

---

# 🏢 Variante : hébergeur Ptero (tu n’as PAS accès au node)

✅ Options possibles :

### Option A : demander à l’hébergeur d’ajouter le hostname → service
Tu fournis :
- hostname `musicia.tondomaine.tld`
- port `31009`
- protocole HTTP

### Option B : utiliser un webhook externe (VPS / proxy)
### Option C : `WEBHOOK_ENABLED=false` (polling only)

---

## 🔒 Sécurité

- Secret webhook long et aléatoire
- Permissions par rôle (évite la facture)
- (Optionnel) Rate limit Cloudflare

---

## 📜 Crédits

- Developed by **Ducratif**
