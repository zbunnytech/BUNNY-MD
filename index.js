// index.js
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pino from 'pino'
import qrcode from 'qrcode'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys'
import { getBotSettings, listenSettingsUpdates, supabase } from './lib/supabase.js'
import { handleMessages } from './lib/router.js'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 1. GLOBAL STATE - Load live settings from Supabase
global.botSettings = await getBotSettings()
console.log('✅ Initial settings loaded. Prefix:', global.botSettings.prefix)

// 2. EXPRESS + SOCKET.IO SETUP for /pair page + UptimeRobot
const app = express()
const server = createServer(app)
const io = new Server(server, { cors: { origin: "*" } })
const PORT = process.env.PORT || 3000

app.use(express.static(join(__dirname, 'public')))
app.use(express.json())

app.get('/', (req, res) => {
  res.send('BUNNY MD is running 🐰')
})

// 3. WHATSAPP BOT CORE
let sock
let qrString = ''
let isConnected = false

async function connectToWhatsApp() {
  const { state, saveCreds } = await useAuthStateSupabase()
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.ubuntu('BUNNY MD'),
    getMessage: async () => ({ conversation: 'BUNNY MD' })
  })

  // 4. HANDLE CONNECTION UPDATES - QR, Pair Code, Online
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrString = qr
      const qrImage = await qrcode.toDataURL(qr)
      io.emit('qr', qrImage)
      io.emit('status', 'Scan QR or use Pair Code')
      console.log('New QR generated')
    }

    if (connection === 'open') {
      isConnected = true
      io.emit('status', 'Connected')
      console.log('WhatsApp connected successfully')
      await sendConfirmationMessage()
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
      isConnected = false
      io.emit('status', 'Disconnected')
      console.log('Connection closed, reconnecting:', shouldReconnect)

      if (shouldReconnect) {
        connectToWhatsApp()
      } else {
        console.log('Logged out. Delete session from b_sessions and restart')
      }
    }
  })

  // 5. SAVE CREDS WHEN UPDATED
  sock.ev.on('creds.update', saveCreds)

  // 6. HANDLE ALL INCOMING MESSAGES - ROUTER.JS TAKES OVER
  sock.ev.on('messages.upsert', (m) => {
    handleMessages(sock, m, global.botSettings)
  })

  // 7. HANDLE PAIR CODE REQUEST FROM FRONTEND
  io.on('connection', (socket) => {
    if (qrString &&!isConnected) {
      qrcode.toDataURL(qrString).then(qrImage => {
        socket.emit('qr', qrImage)
      })
    }

    socket.emit('status', isConnected? 'Connected' : 'Waiting for connection')

    socket.on('request_pair_code', async (phoneNumber) => {
      if (!sock || isConnected) return
      try {
        const code = await sock.requestPairingCode(phoneNumber)
        socket.emit('pair_code', code)
        console.log('Pair code sent:', code)
      } catch (err) {
        socket.emit('pair_error', 'Failed to generate code. Try QR.')
        console.log('Pair code error:', err.message)
      }
    })
  })
}

// 8. SUPABASE AUTH STATE - Save Baileys session to b_sessions table
async function useAuthStateSupabase() {
  const readData = async (id) => {
    const { data } = await supabase.from('b_sessions').select('data').eq('id', id).single()
    return data? JSON.parse(data.data) : null
  }

  const writeData = async (id, value) => {
    await supabase.from('b_sessions').upsert({ id, data: JSON.stringify(value) })
  }

  const creds = await readData('creds') || {}

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {}
          for (const id of ids) {
            const value = await readData(`${type}-${id}`)
            if (value) data[id] = value
          }
          return data
        },
        set: async (data) => {
          for (const category in data) {
            for (const id in data[category]) {
              await writeData(`${category}-${id}`, data[category][id])
            }
          }
        }
      }
    },
    saveCreds: async () => {
      await writeData('creds', creds)
    }
  }
}

// 9. CONFIRMATION MESSAGE - Shows ALL settings from Supabase with On/Off status
async function sendConfirmationMessage() {
  const s = global.botSettings
  const imageUrl = 'https://i.ibb.co/Mdg2Fkd/file-00000000f41871fdb744b8a6b7b612fa.png'

  const formatBool = (val) => val? 'On' : 'Off'

  const caption = `╭─⌈ *${s.botname}* ⌋
│
│ Hello ${sock.user.name || "User"}, bot is online.
│ Owner: ${s.owner_name}
│ Number: ${s.owner_number}
│ Prefix: ${s.prefix}
│
│ *SYSTEM STATUS*
│ Public Mode: ${formatBool(s.public_mode)}
│ Anti-Link: ${formatBool(s.antilink)}
│ Anti-Spam: ${formatBool(s.antispam)}
│ Auto-Read: ${formatBool(s.autoread)}
│ Auto-Typing: ${formatBool(s.autotyping)}
│ View Status: ${formatBool(s.autoviewstatus)}
│
╰⊷ Type ${s.prefix}menu to start`

  try {
    await sock.sendMessage(`${s.owner_number}@s.whatsapp.net`, {
      image: { url: imageUrl },
      caption: caption
    })
    console.log('Confirmation message sent to owner')
  } catch (err) {
    console.log('Failed to send confirmation:', err.message)
  }
}

// 10. LISTEN TO SUPABASE SETTINGS CHANGES - Hot reload without restart
listenSettingsUpdates((newSettings) => {
  global.botSettings = newSettings
  console.log('🔥 Settings updated live. New prefix:', newSettings.prefix)
})

// 11. START EVERYTHING
connectToWhatsApp()
server.listen(PORT, () => {
  console.log(`BUNNY MD Server running on port ${PORT}`)
  console.log(`Pair page will be available at /pair on your Render URL`)
})