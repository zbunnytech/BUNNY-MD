// commands/general/menu.js
import os from 'os'
import { getAllCommands } from '../../lib/router.js'

export const name = 'menu'
export const alias = ['help', 'list', 'commands']
export const category = 'General'
export const desc = 'Displays the complete system interface panel dynamically categorized with server statistic'

/**
 * Highly Optimized Dynamic Menu Generation Engine
 */
export default async function executeAutonomousCommand(sock, { msg, from, pushName, sender }, botSettings) {
  try {
    await sock.sendMessage(from, { react: { text: '🐇', key: msg.key } })

    const totalUptimeSeconds = process.uptime()
    const calculationHours = Math.floor(totalUptimeSeconds / 3600)
    const calculationMinutes = Math.floor((totalUptimeSeconds % 3600) / 60)
    const calculationSeconds = Math.floor(totalUptimeSeconds % 60)
    const structuredUptimeString = `${calculationHours}h ${calculationMinutes}m ${calculationSeconds}s`

    const totalSystemMemoryBytes = os.totalmem()
    const freeSystemMemoryBytes = os.freemem()
    const globalMemoryUtilizationRatio = (totalSystemMemoryBytes - freeSystemMemoryBytes) / totalSystemMemoryBytes
    const dynamicRamProgressBar = '█'.repeat(Math.round(globalMemoryUtilizationRatio * 10)) + '▒'.repeat(10 - Math.round(globalMemoryUtilizationRatio * 10))
    const totalRamUtilizationPercentage = Math.round(globalMemoryUtilizationRatio * 100)

    const underlyingOperatingPlatform = os.platform() === 'linux'? '🐧 Linux' : '🪟 Windows'
    const userIdentity = pushName || sender.split('@')[0]

    // Get commands from router.js - no more fs scanning
    const allCommands = getAllCommands()
    const dynamicCommandCatalog = {}

    for (const [cmdName, cmdData] of allCommands) {
      const category = (cmdData.category || 'Uncategorized').toUpperCase()
      if (!dynamicCommandCatalog[category]) dynamicCommandCatalog[category] = []
      dynamicCommandCatalog[category].push(cmdName)
    }

    const systemPrefixToken = botSettings.prefix || '!'
    const configuredBotName = botSettings.botname || 'BUNNY MD'
    const configuredOwnerName = botSettings.owner_name || 'Lupin Starnley'
    const footerText = 'Powered by Bunny Tech'

    let primaryConstructedMenuBuffer =
`╭──⌈ ${configuredBotName} ⌋
│ User: ${userIdentity}
│ Owner: ${configuredOwnerName}
│ Prefix: [ ${systemPrefixToken} ]
│ Platform: ${underlyingOperatingPlatform}
│ Uptime: ${structuredUptimeString}
│ RAM: ${dynamicRamProgressBar} ${totalRamUtilizationPercentage}%
╰────────────────\n\n`

    for (const cat of Object.keys(dynamicCommandCatalog).sort()) {
      primaryConstructedMenuBuffer += `╭──⌈ ${cat} ⌋\n`
      dynamicCommandCatalog[cat].sort().forEach(cmd => {
        primaryConstructedMenuBuffer += `│ ${systemPrefixToken}${cmd}\n`
      })
      primaryConstructedMenuBuffer += `╰────────────────\n\n`
    }

    primaryConstructedMenuBuffer += `${footerText}`

    // Send with direct URL - no temp file needed
    await sock.sendMessage(from, {
      image: { url: 'https://i.ibb.co/Mdg2Fkd/file-00000000f41871fdb744b8a6b7b612fa.png' },
      caption: primaryConstructedMenuBuffer
    }, { quoted: msg })

  } catch (e) {
    console.error("Menu Error:", e.message)
    await sock.sendMessage(from, { text: "Menu failed to load. Try again." }, { quoted: msg })
  }
}