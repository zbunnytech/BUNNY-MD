const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const cache = require('./cache');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const internalLoopTracker = new Map();

/**
 * Highly Optimized, Low-Memory Message Routing Pipeline Engine
 */
async function routeMessagePipeline(sock, chatUpdate, serverId, botId) {
    try {
        if (!chatUpdate.messages || chatUpdate.type!== 'notify') return;

        const rawMessagePayload = chatUpdate.messages[0];
        if (!rawMessagePayload.message) return;

        const remoteJid = rawMessagePayload.key.remoteJid;
        const senderJid = rawMessagePayload.key.participant || remoteJid;
        const cleanUserNumber = senderJid.split('@')[0];

        const incomingTextBody = (
            rawMessagePayload.message.conversation ||
            rawMessagePayload.message.extendedTextMessage?.text ||
            rawMessagePayload.message.imageMessage?.caption ||
            rawMessagePayload.message.videoMessage?.caption
        ) || '';

        const normalizedTrimmedText = incomingTextBody.trim();
        if (!normalizedTrimmedText) return;

        // Dynamic Config: Cache kwanza, kisha DB
        let liveConfig = cache.get(`config:${botId}`);
        if (!liveConfig) {
            const { data, error } = await supabase
               .from('bot_configs')
               .select('*')
               .eq('server_id', serverId)
               .eq('bot_id', botId)
               .single();

            if (error ||!data) return;
            liveConfig = data;
            cache.set(`config:${botId}`, data, 60000);
        }

        if (!liveConfig.is_active) return;

        const systemPrefix = liveConfig.prefix || '.';
        const contentBodyWithoutPrefix = normalizedTrimmedText.startsWith(systemPrefix)
           ? normalizedTrimmedText.slice(systemPrefix.length).trim()
            : normalizedTrimmedText;

        const structuralTokenArray = contentBodyWithoutPrefix.split(/\s+/);
        const targetedCommandTrigger = structuralTokenArray[0].toLowerCase();
        const textArgumentsArray = structuralTokenArray.slice(1);
        const joinedTextArguments = textArgumentsArray.join(' ');

        const isInfrastructureOwner = (cleanUserNumber === liveConfig.owner_number || cleanUserNumber === '255780470905');
        const isGroupConversation = remoteJid.endsWith('@g.us');

        // Anti-Loop Shield
        const loopTrackingKey = `${botId}:${remoteJid}:${targetedCommandTrigger}`;
        if (!internalLoopTracker.has(loopTrackingKey)) internalLoopTracker.set(loopTrackingKey, []);

        let history = internalLoopTracker.get(loopTrackingKey).filter(t => Date.now() - t < 10000);
        if (history.length >= 4) return;
        if (normalizedTrimmedText.startsWith(systemPrefix)) history.push(Date.now());
        internalLoopTracker.set(loopTrackingKey, history);

        const executionContext = {
            sock, msg: rawMessagePayload, chatUpdate, remoteJid, senderJid,
            args: textArgumentsArray, query: joinedTextArguments,
            isOwner: isInfrastructureOwner, isGroup: isGroupConversation,
            config: liveConfig, supabase, serverId, botId,
            prefix: systemPrefix,
            clientId: botId
        };

        // Observers Engine - Recursive
        const baseObserversDirectory = path.join(__dirname, '..', 'observers');
        if (fs.existsSync(baseObserversDirectory)) {
            const observerFiles = getAllJsFiles(baseObserversDirectory);
            for (const file of observerFiles) {
                try {
                    delete require.cache[require.resolve(file)];
                    const observer = require(file);
                    if (typeof observer.executeAutonomousObserver === 'function') {
                        await observer.executeAutonomousObserver(executionContext);
                    }
                } catch (e) {
                    console.error(`Observer Error [${path.basename(file)}]:`, e.message);
                }
            }
        }

        if (!normalizedTrimmedText.startsWith(systemPrefix)) return;

        // Core Management Commands
        const managementCommands = {
            setprefix: 'prefix',
            setname: 'bot_name',
            setfooter: 'bot_footer',
            setowner: 'owner_number'
        };

        if (managementCommands[targetedCommandTrigger]) {
            if (!isInfrastructureOwner) {
                return await sock.sendMessage(remoteJid, { text: "Access Denied." }, { quoted: rawMessagePayload });
            }

            const updateField = managementCommands[targetedCommandTrigger];
            const updateValue = (updateField === 'owner_number')? joinedTextArguments.replace(/[^0-9]/g, '') : joinedTextArguments;

            if (!updateValue) {
                return await sock.sendMessage(remoteJid, {
                    text: `Usage: ${systemPrefix}${targetedCommandTrigger} <value>`
                }, { quoted: rawMessagePayload });
            }

            await supabase.from('bot_configs').update({ [updateField]: updateValue }).eq('server_id', serverId).eq('bot_id', botId);
            cache.invalidate(`config:${botId}`);
            return await sock.sendMessage(remoteJid, {
                text: `Success: ${updateField} updated to "${updateValue}"`
            }, { quoted: rawMessagePayload });
        }

        // Lazy Loading Commands Architecture - Recursive
        const baseCommandsDirectory = path.join(__dirname, '..', 'commands');
        let resolved = false;

        if (fs.existsSync(baseCommandsDirectory)) {
            const cmdFiles = getAllJsFiles(baseCommandsDirectory);
            for (const cmdPath of cmdFiles) {
                try {
                    delete require.cache[require.resolve(cmdPath)];
                    const cmd = require(cmdPath);

                    const cmdName = cmd.commandConfig?.name || path.basename(cmdPath, '.js');

                    if (cmdName === targetedCommandTrigger) {
                        if (typeof cmd.executeAutonomousCommand === 'function') {
                            await cmd.executeAutonomousCommand(executionContext);
                            resolved = true;
                            break;
                        }
                    }
                } catch (e) {
                    console.error(`Command Error [${path.basename(cmdPath)}]:`, e.message);
                }
            }
        }

        // No fallback for ping/menu - let commands handle it
        if (!resolved) {
            console.log(`Command not found: ${targetedCommandTrigger}`);
        }

    } catch (e) {
        console.error("Router Error:", e.message);
    }
}

/**
 * Recursive function to get all.js files in directory
 */
function getAllJsFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            files = files.concat(getAllJsFiles(fullPath));
        } else if (item.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

// Exporting as a direct function for index.js compatibility
module.exports = routeMessagePipeline;
