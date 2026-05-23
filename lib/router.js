// lib/router.js
import { readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const commands = new Map() // name -> command object
const aliases = new Map()  // alias -> command name
const observers = []

// 1. RECURSIVE FUNCTION TO LOAD COMMANDS FROM ALL SUBFOLDERS
async function loadCommands(dir) {
  const items = readdirSync(dir)
  
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    
    if (stat.isDirectory()) {
      // If folder, go deeper
      await loadCommands(fullPath)
    } else if (item.endsWith('.js')) {
      // If .js file, import it
      try {
        const filePath = pathToFileURL(fullPath).href
        const commandModule = await import(filePath)
        
        // Command must have name and default export function
        if (!commandModule.name || typeof commandModule.default!== 'function') {
          console.log(`❌ Skipped ${item}: Missing 'name' or default export`)
          continue
        }
        
        const cmdData = {
          name: commandModule.name.toLowerCase(),
          alias: commandModule.alias || [],
          category: commandModule.category || 'Uncategorized',
          desc: commandModule.desc || 'No description',
          run: commandModule.default
        }
        
        commands.set(cmdData.name, cmdData)
        
        // Register aliases
        for (const alias of cmdData.alias) {
          aliases.set(alias.toLowerCase(), cmdData.name)
        }
        
        console.log(`✅ Loaded: ${cmdData.name} [${cmdData.category}]`)
      } catch (err) {
        console.log(`❌ Error loading ${item}:`, err.message)
      }
    }
  }
}

// 2. LOAD ALL COMMANDS ON STARTUP
const commandsPath = join(__dirname, '..', 'commands')
await loadCommands(commandsPath)

// 3. LOAD ALL OBSERVERS - These run on every message without prefix
const observersPath = join(__dirname, '..', 'observers')
try {
  const observerFiles = readdirSync(observersPath).filter(file => file.endsWith('.js'))
  for (const file of observerFiles) {
    const filePath = pathToFileURL(join(observersPath, file)).href
    const observer = await import(filePath)
    if (typeof observer.default === 'function') {
      observers.push(observer.default)
      console.log(`✅ Loaded observer: ${file.replace('.js', '')}`)
    }
  }
} catch (err) {
  console.log('No observers folder found. Skipping.')
}

// 4. EXPORT COMMANDS FOR MENU.JS TO USE
export function getAllCommands() {
  return commands
}

// 5. MAIN MESSAGE HANDLER - Called from index.js for every message
export async function handleMessages(sock, m, botSettings) {
  if (m.type!== 'notify') return
  const msg = m.messages[0]
  if (!msg.message || msg.key.fromMe) return

  const from = msg.key.remoteJid
  const isGroup = from.endsWith('@g.us')
  const sender = isGroup? msg.key.participant : from
  const pushName = msg.pushName || 'User'

  // Get message text from all message types
  const body = msg.message.conversation ||
               msg.message.extendedTextMessage?.text ||
               msg.message.imageMessage?.caption ||
               msg.message.videoMessage?.caption || ''

  // 6. RUN OBSERVERS FIRST - These don't need prefix
  for (const observer of observers) {
    try {
      await observer(sock, { msg, from, sender, body, isGroup, pushName }, botSettings)
    } catch (err) {
      console.log('Observer error:', err.message)
    }
  }

  // 7. CHECK IF MESSAGE IS A COMMAND
  if (!body.startsWith(botSettings.prefix)) return

  // Extract command and arguments
  const args = body.slice(botSettings.prefix.length).trim().split(/ +/)
  const providedName = args.shift().toLowerCase()

  // 8. FIND COMMAND BY NAME OR ALIAS
  const commandName = commands.has(providedName)? providedName : aliases.get(providedName)
  if (!commandName) return

  const command = commands.get(commandName)
  if (!command) return

  // 9. CHECK PUBLIC MODE - If public_mode is false, only owner can use commands
  const ownerJid = `${botSettings.owner_number}@s.whatsapp.net`
  if (!botSettings.public_mode && sender!== ownerJid) {
    return // Silently ignore if not public and not owner
  }

  // 10. EXECUTE COMMAND
  try {
    await command.run(sock, { msg, from, sender, args, isGroup, pushName, body, commandName }, botSettings)
    console.log(`Command executed: ${commandName} by ${pushName}`)
  } catch (err) {
    console.log(`Command error in ${commandName}:`, err.message)
    await sock.sendMessage(from, { text: `Error executing command: ${commandName}` })
  }
}