# 🐰 BUNNY MD - WhatsApp Bot

<div align="center">
  <img src="https://i.imgur.com/8QfG7vJ.png" alt="BUNNY MD Banner" width="600">
  
  **The Most Advanced WhatsApp MD Bot with Baileys 7.0.0 + Supabase**
  
  [[Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)
  [[WhatsApp Bot](https://img.shields.io/badge/WhatsApp-Bot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/255780470905)
  [[Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [[Baileys](https://img.shields.io/badge/Baileys-7.0.0--rc.9-000000?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
</div>

---

## ✨ Features

| **Category** | **Features** |
| --- | --- |
| **Connection** | QR Code + Pair Code Login, Auto Reconnect, Session Storage |
| **Database** | Supabase Realtime Integration, Cloud Session Backup |
| **Commands** | Downloaders, AI Chat, Group Manager, Owner Tools |
| **Tech Stack** | Baileys 7.0.0-rc.9, Node.js 20.x, Express, Socket.IO |
| **Deployment** | One-Click Render Deploy, 24/7 Online, Zero Config |

## 🚀 Quick Start

### **1. Get Your WhatsApp Session**

After deploying, visit your bot's pair page to connect WhatsApp:

**👉 [Click Here to Open Pair Page](/pair.html)**

> **Important:** Use `/pair.html` not `/pair` - The `.html` extension is required

Scan the QR code with WhatsApp > Linked Devices > Link a Device

### **2. Deploy to Render**

1. Fork this repository
2. [Deploy to Render](https://render.com) as a Web Service
3. Add Environment Variables:
4. Deploy and visit `/pair.html` to scan QR

## 📋 Requirements
-- Sessions table for WhatsApp auth
CREATE TABLE IF NOT EXISTS b_sessions (
  id TEXT PRIMARY KEY,
  data TEXT
);

-- Bot settings table
CREATE TABLE IF NOT EXISTS b_settings (
  id TEXT PRIMARY KEY DEFAULT 'BUNNY_DEFAULT',
  botname TEXT DEFAULT 'BUNNY MD',
  owner_number TEXT DEFAULT '255780470905',
  owner_name TEXT DEFAULT 'Lupin Starnley',
  prefix TEXT DEFAULT '!',
  public_mode BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO b_settings (id) VALUES ('BUNNY_DEFAULT') 
ON CONFLICT (id) DO NOTHING;
*HII HAPA CODE FULL YA `README.md` - COPY YOTE MARA MOJA KAKA 🐰*
🐰 BUNNY MD - WhatsApp Bot

<div align="center">
  <img src="https://i.imgur.com/8QfG7vJ.png" alt="BUNNY MD Banner" width="600">
  
  **The Most Advanced WhatsApp MD Bot with Baileys 7.0.0 + Supabase**
  
  [[Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)
  [[WhatsApp Bot](https://img.shields.io/badge/WhatsApp-Bot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/255780470905)
  [[Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [[Baileys](https://img.shields.io/badge/Baileys-7.0.0--rc.9-000000?style=for-the-badge)](https://github.com/WhiskeySockets/Baileys)
</div>

---

✨ Features

| **Category** | **Features** |
| --- | --- |
| **Connection** | QR Code + Pair Code Login, Auto Reconnect, Session Storage |
| **Database** | Supabase Realtime Integration, Cloud Session Backup |
| **Commands** | Downloaders, AI Chat, Group Manager, Owner Tools |
| **Tech Stack** | Baileys 7.0.0-rc.9, Node.js 20.x, Express, Socket.IO |
| **Deployment** | One-Click Render Deploy, 24/7 Online, Zero Config |

🚀 Quick Start

**1. Get Your WhatsApp Session**

After deploying, visit your bot's pair page to connect WhatsApp:

**👉 [Click Here to Open Pair Page](/pair.html)**

> **Important:** Use `/pair.html` not `/pair` - The `.html` extension is required

Scan the QR code with WhatsApp > Linked Devices > Link a Device

**2. Deploy to Render**

1. Fork this repository
2. [Deploy to Render](https://render.com) as a Web Service
3. Add Environment Variables:
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   NODE_VERSION=20.11.1
4. Deploy and visit `/pair.html` to scan QR

📋 Requirements

- **Node.js** `20.11.1` - Required for Baileys 7.0.0-rc.9 stability
- **Supabase Account** - For session storage and realtime settings
- **Render Account** - For 24/7 free hosting

🔧 Environment Variables

Create these in Render Dashboard > Environment:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_VERSION=20.11.1
OWNER_NUMBER=255780470905
BOT_NAME=BUNNY MD
PREFIX=!
📱 Commands
**Command**	**Category**	**Description**
`!play <song>`	Downloader	Download music from YouTube
`!alive`	General	Check if bot is online
`!menu`	General	Show all commands
`!ping`	General	Check response time
`!setprefix <symbol>`	Owner	Change command prefix
`!setbotname <name>`	Owner	Change bot name
`!setowner <number>`	Owner	Change owner number
🗄️ Database Setup

Run this SQL in your Supabase SQL Editor:
-- Sessions table for WhatsApp auth
CREATE TABLE IF NOT EXISTS b_sessions (
  id TEXT PRIMARY KEY,
  data TEXT
);

-- Bot settings table
CREATE TABLE IF NOT EXISTS b_settings (
  id TEXT PRIMARY KEY DEFAULT 'BUNNY_DEFAULT',
  botname TEXT DEFAULT 'BUNNY MD',
  owner_number TEXT DEFAULT '255780470905',
  owner_name TEXT DEFAULT 'Lupin Starnley',
  prefix TEXT DEFAULT '!',
  public_mode BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO b_settings (id) VALUES ('BUNNY_DEFAULT') 
ON CONFLICT (id) DO NOTHING;
🌐 Live Demo

*Pair Page:* `https://bunny-md.onrender.com/pair.html`

*Note:* Always include `.html` at the end of the pair URL

👨‍💻 Developer

*Lupin Starnley* - _Creator of BUNNY MD_

- GitHub: https://github.com/zbunnytech
- WhatsApp: https://wa.me/255780470905
- Repository: https://github.com/zbunnytech/BUNNY-MD

⚠️ Important Notes

1. *Node Version*: Must use Node `20.11.1` - Node 26 breaks QR generation
2. *Pair URL*: Always use `/pair.html` with the `.html` extension
3. *Supabase*: Requires `ws` package for Node 20 WebSocket support
4. *Session*: Sessions are stored in Supabase `b_sessions` table
5. *Build Command*: Use `npm install --legacy-peer-deps` on Render

🐛 Troubleshooting
**Problem**	**Solution**
QR not showing	Use Node 20.11.1 + Check `/pair.html`
`Connection closed` loop	Delete `b_sessions` table data and rescan
`WebSocket` error	Install `ws` package and update `supabase.js`
Bot offline	Check Render logs for `✅ WhatsApp connected`
📄 License

This project is licensed under the ISC License.

---

<div align="center">
  <img src="https://i.imgur.com/8QfG7vJ.png" alt="BUNNY MD" width="200">
  
  *Made with ❤️ by Lupin Starnley*
  
  _If you like this bot, give it a ⭐ on GitHub!_
</div>

**COPY YOTE HII WEKA KWA `README.md` KAKA 🐰💨**

Badilisha tu `bunny-md.onrender.com` na link ya picha kama una yako.

- **Node.js** `20.11.1` - Required for Baileys 7.0.0-rc.9 stability
- **Supabase Account** - For session storage and realtime settings
- **Render Account** - For 24/7 free hosting

## 🔧 Environment Variables

Create these in Render Dashboard > Environment:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_VERSION=20.11.1
OWNER_NUMBER=255780470905
BOT_NAME=BUNNY MD
PREFIX=!