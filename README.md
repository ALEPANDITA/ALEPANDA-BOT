# ALEPANDA-BOT

Bot de WhatsApp hecho con Baileys, pensado para correr en Termux.

## Requisitos
- Termux (Android)
- Node.js
- ffmpeg
- yt-dlp (Python)

## Instalacion

```bash
pkg update && pkg upgrade -y
pkg install nodejs git ffmpeg python -y
pip install yt-dlp --break-system-packages

git clone https://github.com/TU_USUARIO/alepanda-bot.git
cd alepanda-bot
npm install
