module.exports = {
    commandConfig,
    executeAutonomousCommand
};

const fs = require('fs');
const path = require('path');
const os = require('os');
const yts = require('yt-search');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');

/**
 * Metadata Configuration Block for Dynamic System Menu Generation
 */
const commandConfig = {
    name: 'play',
    category: 'download',
    description: 'Search and download music from YouTube with thumbnail preview.'
};

/**
 * Advanced Music Download Command Node
 */
async function executeAutonomousCommand(context) {
    const { sock, msg, remoteJid, query, config } = context;

    try {
        if (!query) {
            return await sock.sendMessage(remoteJid, {
                text: `Usage: ${config.prefix || '.'}play <song name>`
            }, { quoted: msg });
        }

        await sock.sendMessage(remoteJid, {
            react: { text: '🎵', key: msg.key }
        });

        const searchResult = await yts(query);
        if (!searchResult.videos.length) {
            return await sock.sendMessage(remoteJid, {
                text: `No results found for "${query}"`
            }, { quoted: msg });
        }

        const video = searchResult.videos[0];
        const videoUrl = video.url;
        const videoTitle = video.title;
        const videoAuthor = video.author.name;
        const videoDuration = video.timestamp;
        const thumbnailUrl = video.thumbnail;

        const infoPayload =
`╭─⌈ 🎵 *Music Found* ⌋
│ Title: ${videoTitle}
│ Artist: ${videoAuthor}
│ Duration: ${videoDuration}
│ Quality: 128kbps
╰⊷ Downloading audio...`;

        await sock.sendMessage(remoteJid, {
            image: { url: thumbnailUrl },
            caption: infoPayload
        }, { quoted: msg });

        const tempFilePath = path.join(os.tmpdir(), `${Date.now()}.mp3`);
        const audioStream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });

        await new Promise((resolve, reject) => {
            ffmpeg(audioStream)
               .audioBitrate(128)
               .format('mp3')
               .save(tempFilePath)
               .on('end', resolve)
               .on('error', reject);
        });

        await sock.sendMessage(remoteJid, {
            audio: { url: tempFilePath },
            mimetype: 'audio/mpeg',
            fileName: `${videoTitle}.mp3`
        }, { quoted: msg });

        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    } catch (commandException) {
        console.error(`[Command Exception] Critical failure inside download/play.js execution tree:`, commandException.message);

        try {
            await sock.sendMessage(remoteJid, {
                text: `\`\`Audio download failed. Try another song or check the link.\`\``
            }, {
                quoted: msg
            });
        } catch (secondaryFault) {
            console.error(`[Command Fatal] Emergency reporting pipe severed:`, secondaryFault.message);
        }
    }
                                                       }
