// commands/general/uptime.js
import { supabase } from '../../lib/supabase.js'

export const name = 'uptime'
export const alias = ['runtime', 'up']
export const category = 'General'
export const desc = 'Shows bot uptime since session was generated'

export default async function uptime(sock, { msg, from }, botSettings) {
  try {
    // 1. React kwanza
    await sock.sendMessage(from, {
      react: { text: '🎱', key: msg.key }
    })

    // 2. Chukua timestamp ya session kutoka Supabase
    const { data, error } = await supabase
      .from('b_sessions')
      .select('created_at')
      .eq('id', 'creds')
      .single()

    if (error || !data) {
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🎱 *BUNNY UPTIME* ⌋\n│\n│ Session not found in database\n│ Please scan QR again\n│\n╰⊷ *${botSettings.botname}*`
      }, { quoted: msg })
    }

    // 3. Calculate muda toka session ilitengenezwa
    const sessionStart = new Date(data.created_at)
    const now = new Date()
    const diffMs = now - sessionStart

    const seconds = Math.floor(diffMs / 1000) % 60
    const minutes = Math.floor(diffMs / (1000 * 60)) % 60
    const hours = Math.floor(diffMs / (1000 * 60 * 60)) % 24
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    // 4. Format tarehe ya session
    const sessionDate = sessionStart.toLocaleString('en-GB', {
      timeZone: 'Africa/Dar_es_Salaam',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    // 5. Tengeneza caption nzuri
    const uptimeText = `╭─⌈ 🎱 *BUNNY UPTIME* ⌋
│
│ *Session Active Since:*
│ ${sessionDate} EAT
│
│ *Total Runtime:*
│ ${days} Days, ${hours} Hours
│ ${minutes} Minutes, ${seconds} Seconds
│
│ *Status:* Online & Stable 🐰
│ *Platform:* Render Cloud
│ *Version:* BUNNY MD v1.0
│
╰⊷ *${botSettings.botname}*`

    await sock.sendMessage(from, { 
      text: uptimeText 
    }, { quoted: msg })

  } catch (err) {
    console.error('[UPTIME ERROR]', err.message)
    await sock.sendMessage(from, { 
      text: `╭─⌈ 🎱 *BUNNY UPTIME* ⌋\n│\n│ Failed to fetch uptime\n│ Error: ${err.message}\n│\n╰⊷ *${botSettings.botname}*` 
    }, { quoted: msg })
  }
}