// commands/downloader/play.js
import fs from 'fs'
import path from 'path'
import os from 'os'
import yts from 'yt-search'
import ytdl from 'ytdl-core'
import ffmpeg from 'fluent-ffmpeg'

export const name = 'play'
export const alias = ['song', 'ytaudio', 'music']
export const category = 'Downloader'
export const desc = 'Search and download music from YouTube with thumbnail preview'

export default async function play(sock, { msg, from, args }, botSettings) {
  const tempFilePath = path.join(os.tmpdir(), `bunny_${Date.now()}.mp3`)
  
  try {
    const query = args.join(' ')
    if (!query) {
      return await sock.sendMessage(from, { 
        text: `> Usage: ${botSettings.prefix}play <song name>\n> Example: ${botSettings.prefix}play Burna Boy Last Last` 
      }, { quoted: msg })
    }

    await sock.sendMessage(from, {
      react: { text: '🎵', key: msg.key }
    })

    // 1. Search YouTube
    const searchResult = await yts(query)
    if (!searchResult.videos.length) {
      return await sock.sendMessage(from, { 
        text: `> No results found for "${query}"` 
      }, { quoted: msg })
    }

    const video = searchResult.videos[0]
    
    // 2. Check duration - limit 10 mins to avoid big files
    const [min, sec] = video.timestamp.split(':').map(Number)
    const totalSeconds = min * 60 + sec
    if (totalSeconds > 600) {
      return await sock.sendMessage(from, { 
        text: `> Song too long: ${video.timestamp}\n> Max duration is 10:00 minutes` 
      }, { quoted: msg })
    }

    // 3. Send info card
    const infoPayload =
`╭─⌈ 🎵 *${botSettings.botname || 'BUNNY MD'}* ⌋
│ Title: ${video.title.slice(0, 40)}
│ Artist: ${video.author.name}
│ Duration: ${video.timestamp}
│ Views: ${video.views.toLocaleString()}
│ Quality: 128kbps MP3
╰⊷ Downloading audio...`

    await sock.sendMessage(from, {
      image: { url: video.thumbnail },
      caption: infoPayload
    }, { quoted: msg })

    // 4. Download + Convert with FFmpeg
    const audioStream = ytdl(video.url, { 
      filter: 'audioonly', 
      quality: 'highestaudio',
      highWaterMark: 1 << 25 // 32MB buffer
    })

    await new Promise((resolve, reject) => {
      ffmpeg(audioStream)
        .audioBitrate(128)
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('start', () => console.log(`[PLAY] Converting: ${video.title}`))
        .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .save(tempFilePath)
        .on('end', resolve)
    })

    // 5. Check file size - WhatsApp limit 100MB
    const stats = fs.statSync(tempFilePath)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
    if (stats.size > 95 * 1024) {
      fs.unlinkSync(tempFilePath)
      return await sock.sendMessage(from, { 
        text: `> File too large: ${fileSizeMB}MB\n> WhatsApp limit is 100MB` 
      }, { quoted: msg })
    }

    // 6. Send audio
    await sock.sendMessage(from, {
      audio: { url: tempFilePath },
      mimetype: 'audio/mpeg',
      fileName: `${video.title.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 30)}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: video.title,
          body: `${video.author.name} • ${video.timestamp}`,
          thumbnailUrl: video.thumbnail,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: msg })

    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

  } catch (commandException) {
    console.error(`[PLAY ERROR]`, commandException.message)
    
    let errorMsg = '> Audio download failed.'
    if (commandException.message.includes('Status code: 410')) {
      errorMsg = '> YouTube link expired. Try searching again.'
    } else if (commandException.message.includes('unavailable')) {
      errorMsg = '> Video is unavailable or age-restricted.'
    } else if (commandException.message.includes('FFmpeg')) {
      errorMsg = '> Audio conversion failed. Server issue.'
    }
    
    await sock.sendMessage(from, { text: errorMsg }, { quoted: msg })
    
  } finally {
    // Cleanup temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath)
      console.log(`[PLAY] Cleaned temp file`)
    }
  }
}