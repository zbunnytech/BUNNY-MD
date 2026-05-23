// index.js
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pino from 'pino'
import qrcode from 'qrcode'
import pkg from '@whiskeysockets/baileys' // BADILISHA HII
const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = pkg // NA HII
import { getBotSettings, listenSettingsUpdates, supabase } from './lib/supabase.js'
import { initializeRouter, handleMessages } from './lib/router.js'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 1. GLOBAL STATE
let botSettings = null
let sock = null
let qrString = ''
let isConnected = false

// 2. EXPRESS + SOCKET.IO SETUP
const app = express()
const server = createServer(app)
const io = new Server(server, { cors: { origin: "*" } })
const PORT = process.env.PORT || 3000

app.use(express.static(join(__dirname, 'public')))
app.use(express.json())

app.get('/', (req, res) => {
  res.send('BUNNY MD is running 🐰')
})

// 3. SUPABASE AUTH STATE - Returns null if no session exists
async function useAuthStateSupabase() {
  const readData = async (id) => {
    try {
      const { data, error } = await supabase.from('b_sessions').select('data').eq('id', id).single()
      if (error ||!data) return null
      return JSON.parse(data.data)
    } catch (e) {
      return null
    }
  }

  const writeData = async (id, value) => {
    await supabase.from('b_sessions').upsert({ id, data: JSON.stringify(value) })
  }

  const removeData = async (id) => {
    await supabase.from('b_sessions').delete().eq('id', id)
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
    },
    clearSession: async () => {
      await removeData('creds')
    }
  }
}

// 4. WHATSAPP CONNECTION - Checks session first
async function connectToWhatsApp() {
  const { state, saveCreds, clearSession } = await useAuthStateSupabase()
  const { version } = await fetchLatestBaileysVersion()

  const hasSession = state.creds?.noiseKey? true : false

  if (!hasSession) {
    console.log('🔍 No session found in Supabase. QR will be generated for /pair.html')
  } else {
    console.log('🔄 Existing session found. Attempting to restore...')
  }

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['BUNNY MD', 'Chrome', '120.0.0'],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 10000,
    emitOwnEvents: true,
    fireInitQueries: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    retryRequestDelayMs: 250
  })

  // 5. HANDLE CONNECTION UPDATES
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrString = qr
      const qrImage = await qrcode.toDataURL(qr)
      io.emit('qr', qrImage)
      io.emit('status', 'Scan QR or use Pair Code')
      console.log('📱 New QR generated - check /pair.html page')
    }

    if (connection === 'open') {
      isConnected = true
      qrString = ''
      io.emit('status', 'Connected')
      console.log('✅ WhatsApp connected successfully!')
      await sendConfirmationMessage()
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode!== DisconnectReason.loggedOut

      isConnected = false
      io.emit('status', 'Disconnected')
      console.log('Connection closed. Reason:', lastDisconnect?.error?.message)

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('❌ Logged out. Clearing session from Supabase...')
        await clearSession()
        qrString = ''
        setTimeout(() => connectToWhatsApp(), 3000)
      } else if (shouldReconnect) {
        console.log('🔄 Reconnecting in 5 seconds...')
        setTimeout(() => connectToWhatsApp(), 5000)
      } else {
        console.log('⚠️ Connection closed. Restarting in 10 seconds...')
        setTimeout(() => connectToWhatsApp(), 10000)
      }
    }
  })

  // 6. SAVE CREDS WHEN UPDATED
  sock.ev.on('creds.update', saveCreds)

  // 7. HANDLE ALL INCOMING MESSAGES
  sock.ev.on('messages.upsert', (m) => {
    handleMessages(sock, m, botSettings)
  })
}

// 8. HANDLE PAIR CODE REQUEST FROM FRONTEND
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

// 9. CONFIRMATION MESSAGE
async function sendConfirmationMessage() {
  const s = botSettings
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

// 10. MAIN START FUNCTION
async function startBot() {
  try {
    await initializeRouter()
    botSettings = await getBotSettings()
    if (!botSettings) {
      console.error('❌ Failed to load bot settings from Supabase')
      process.exit(1)
    }
    console.log('✅ Initial settings loaded. Prefix:', botSettings.prefix)

    listenSettingsUpdates((newSettings) => {
      botSettings = newSettings
      console.log('🔥 Settings updated live. New prefix:', newSettings.prefix)
    })

    await connectToWhatsApp()

    server.listen(PORT, () => {
      console.log(`BUNNY MD Server running on port ${PORT}`)
      console.log(`Pair page will be available at /pair.html on your Render URL`)
    })

  } catch (err) {
    console.error('Bot failed to start:', err)
    process.exit(1)
  }
}

// 11. START EVERYTHING
startBot()