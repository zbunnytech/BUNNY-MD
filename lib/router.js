// lib/router.js
import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 1. LOAD ALL COMMAND FILES ON STARTUP
const commandsPath = join(__dirname, '..', 'commands')
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'))
const commands = new Map()

for (const file of commandFiles) {
  const filePath = pathToFileURL(join(commandsPath, file)).href
  const command = await import(filePath)
  const name = file.replace('.js', '').toLowerCase()
  commands.set(name, command.default)
  console.log(`✅ Loaded command: ${name}`)
}

// 2. LOAD ALL OBSERVER FILES - These run on every message without prefix
const observersPath = join(__dirname, '..', 'observers')
let observers = []
try {
  const observerFiles = readdirSync(observersPath).filter(file => file.endsWith('.js'))
  for (const file of observerFiles) {
    const filePath = pathToFileURL(join(observersPath, file)).href
    const observer = await import(filePath)
    observers.push(observer.default)
    console.log(`✅ Loaded observer: ${file.replace('.js', '')}`)
  }
} catch (err) {
  console.log('No observers folder found. Skipping.')
}

// 3. MAIN MESSAGE HANDLER - Called from index.js for every message
export async function handleMessages(sock, m, botSettings) {
  if (m.type!== 'notify') return
  const msg = m.messages[0]
  if (!msg.message || msg.key.fromMe) return

  const from = msg.key.remoteJid
  const isGroup = from.endsWith('@g.us')
  const sender = isGroup? msg.key.participant : from
  const pushName = msg.pushName || 'User'

  // Get message text
  const body = msg.message.conversation ||
               msg.message.extendedTextMessage?.text ||
               msg.message.imageMessage?.caption || ''

  // 4. RUN OBSERVERS FIRST - These don't need prefix
  for (const observer of observers) {
    try {
      await observer(sock, { msg, from, sender, body, isGroup, pushName }, botSettings)
    } catch (err) {
      console.log('Observer error:', err.message)
    }
  }

  // 5. CHECK IF MESSAGE IS A COMMAND
  if (!body.startsWith(botSettings.prefix)) return

  // Extract command and arguments
  const args = body.slice(botSettings.prefix.length).trim().split(/ +/)
  const commandName = args.shift().toLowerCase()

  // Check if command exists
  const command = commands.get(commandName)
  if (!command) return

  // 6. CHECK PUBLIC MODE - If public_mode is false, only owner can use commands
  const ownerJid = `${botSettings.owner_number}@s.whatsapp.net`
  if (!botSettings.public_mode && sender!== ownerJid) {
    return // Silently ignore if not public and not owner
  }

  // 7. EXECUTE COMMAND
  try {
    await command(sock, { msg, from, sender, args, isGroup, pushName, body }, botSettings)
    console.log(`Command executed: ${commandName} by ${pushName}`)
  } catch (err) {
    console.log(`Command error in ${commandName}:`, err.message)
    await sock.sendMessage(from, { text: `Error executing command: ${commandName}` })
  }
}