module.exports = { 
    commandConfig, 
    executeAutonomousCommand 
};

/**
 * Metadata Configuration Block for Dynamic System Menu Generation
 */
const commandConfig = {
    name: 'setname',
    category: 'settings',
    description: 'Update the bot name in real-time without restart.'
};

/**
 * Bot Name Update Command Node
 */
async function executeAutonomousCommand(context) {
    const { sock, msg, remoteJid, query, supabase, config, isOwner, clientId } = context;

    try {
        if (!isOwner) {
            return await sock.sendMessage(remoteJid, {
                text: 'Access Denied. Only the owner can change settings.'
            }, { quoted: msg });
        }

        if (!query) {
            return await sock.sendMessage(remoteJid, {
                text: `Usage: ${config.prefix || '.'}setname <new_name>\nExample: ${config.prefix || '.'}setname Bunny Pro`
            }, { quoted: msg });
        }

        const newName = query.trim();

        await supabase
            .from('bunny_settings')
            .update({ extra_data: { current: newName } })
            .eq('client_id', clientId)
            .eq('setting_name', 'bot_name');

        await sock.sendMessage(remoteJid, {
            react: { text: '🐉', key: msg.key }
        });

        const successPayload = 
`╭─⌈ ⚙️ *Settings Updated* ⌋
│ Bot name changed to: ${newName}
│ Status: Applied instantly
╰⊷ *${newName}*`;

        await sock.sendMessage(remoteJid, { 
            text: successPayload 
        }, { 
            quoted: msg 
        });

    } catch (commandException) {
        console.error(`[Command Exception] Critical failure inside settings/setname.js execution tree:`, commandException.message);
        
        await sock.sendMessage(remoteJid, { 
            text: `\`\`Failed to update bot name. Check database connection.\`\`` 
        }, { 
            quoted: msg 
        });
    }
}
