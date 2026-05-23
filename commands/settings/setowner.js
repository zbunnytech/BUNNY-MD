// commands/settings/setowner.js
import { supabase } from '../../lib/supabase.js'

export const name = 'setowner'
export const alias = ['sowner', 'newowner']
export const category = 'Owner'
export const desc = 'Update the bot owner number in real-time without restart'

export default async function setowner(sock, { msg, from, sender }, botSettings) {
  try {
    // 1. Owner check - only current owner can change owner
    const currentOwnerJid = `${botSettings.owner_number}@s.whatsapp.net`
    if (sender !== currentOwnerJid) {
      return await sock.sendMessage(from, { 
        text: '> Access Denied. Only the owner can change settings.' 
      }, { quoted: msg })
    }

    // 2. Get new owner number from args
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const newOwner = args.join(' ').trim().replace(/[^0-9]/g, '')

    if (!newOwner) {
      return await sock.sendMessage(from, { 
        text: `> Usage: ${botSettings.prefix}setowner <number>\n> Example: ${botSettings.prefix}setowner 255780470905\n> Note: Enter number without + or spaces` 
      }, { quoted: msg })
    }

    if (newOwner.length < 10 || newOwner.length > 15) {
      return await sock.sendMessage(from, { 
        text: `> Invalid number format. Use international format without +\n> Example: 255780470905` 
      }, { quoted: msg })
    }

    // 3. Prevent setting same owner
    if (newOwner === botSettings.owner_number) {
      return await sock.sendMessage(from, { 
        text: `> That number is already set as owner: ${newOwner}` 
      }, { quoted: msg })
    }

    // 4. Update Supabase b_settings table
    const { data, error } = await supabase
      .from('b_settings')
      .update({ owner_number: newOwner })
      .eq('id', 'BUNNY_DEFAULT')
      .select()

    if (error) {
      console.error('Supabase update error:', error.message)
      return await sock.sendMessage(from, { 
        text: '> Failed to update owner number. Database error.' 
      }, { quoted: msg })
    }

    // 5. React + Success message
    await sock.sendMessage(from, {
      react: { text: '🏵️', key: msg.key }
    })

    const successPayload = 
`╭─⌈ ⚙️ *Settings Updated* ⌋
│ Owner number changed to: ${newOwner}
│ Status: Applied instantly
│ Old Owner: ${botSettings.owner_number}
╰⊷ *${botSettings.botname || 'BUNNY MD'}*`

    await sock.sendMessage(from, { 
      text: successPayload 
    }, { quoted: msg })

    // 6. Notify new owner
    try {
      await sock.sendMessage(`${newOwner}@s.whatsapp.net`, {
        text: `> You are now set as the owner of *${botSettings.botname}*.\n> Use ${botSettings.prefix}menu to see owner commands.`
      })
    } catch (e) {
      console.log('Failed to notify new owner:', e.message)
    }

  } catch (commandException) {
    console.error(`[SETOWNER ERROR]`, commandException.message)
    await sock.sendMessage(from, { 
      text: '> Failed to update owner number. Check database connection.' 
    }, { quoted: msg })
  }
}