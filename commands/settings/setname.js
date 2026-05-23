// commands/settings/setbotname.js
import { createClient } from '@supabase/supabase-js'

export const name = 'setbotname'
export const alias = ['setname', 'botname']
export const category = 'Owner'
export const desc = 'Update the bot name in real-time without restart'

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export default async function setbotname(sock, { msg, from, sender, args }, botSettings) {
  try {
    // 1. Owner check
    const ownerJid = `${botSettings.owner_number}@s.whatsapp.net`
    if (sender !== ownerJid) {
      return await sock.sendMessage(from, { 
        text: '> Access Denied. Only the owner can change settings.' 
      }, { quoted: msg })
    }

    // 2. Get new name
    const newName = args.join(' ').trim()
    if (!newName) {
      return await sock.sendMessage(from, { 
        text: `> Usage: ${botSettings.prefix}setbotname <new_name>\n> Example: ${botSettings.prefix}setbotname BUNNY PRO` 
      }, { quoted: msg })
    }

    if (newName.length > 30) {
      return await sock.sendMessage(from, { 
        text: '> Bot name too long. Max 30 characters.' 
      }, { quoted: msg })
    }

    // 3. Update Supabase b_settings table
    const { data, error } = await supabase
      .from('b_settings')
      .update({ botname: newName })
      .eq('id', 'BUNNY_DEFAULT')
      .select()

    if (error) {
      console.error('Supabase update error:', error.message)
      return await sock.sendMessage(from, { 
        text: '> Failed to update bot name. Database error.' 
      }, { quoted: msg })
    }

    // 4. React + Success message
    await sock.sendMessage(from, {
      react: { text: '🐉', key: msg.key }
    })

    const successPayload = 
`╭─⌈ ⚙️ *Settings Updated* ⌋
│ Bot name changed to: ${newName}
│ Status: Applied instantly
│ Database: Synced
╰⊷ *${newName}*`

    await sock.sendMessage(from, { 
      text: successPayload 
    }, { quoted: msg })

  } catch (commandException) {
    console.error(`[SETBOTNAME ERROR]`, commandException.message)
    await sock.sendMessage(from, { 
      text: '> Failed to update bot name. Check database connection.' 
    }, { quoted: msg })
  }
}