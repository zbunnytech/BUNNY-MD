module.exports = { 
    commandConfig, 
    executeAutonomousCommand 
};

/**
 * Metadata Configuration Block for Dynamic System Menu Generation
 */
const commandConfig = {
    name: 'alive',
    category: 'general',
    description: 'Checks if the bot is online and responsive.'
};

/**
 * Simple Alive Command Node
 */
async function executeAutonomousCommand(context) {
    const { sock, msg, remoteJid, config } = context;

    try {
        await sock.sendMessage(remoteJid, {
            react: {
                text: '🦋',
                key: msg.key
            }
        });

        const activeBotIdentityName = config.bot_name || 'Bunny MD';

        const alivePayload = 
`╭─⌈ ⚡ *${activeBotIdentityName}* ⌋
│ Status: Online
╰⊷ *${activeBotIdentityName}*`;

        await sock.sendMessage(remoteJid, { 
            text: alivePayload 
        }, { 
            quoted: msg 
        });

    } catch (commandException) {
        console.error(`[Command Exception] Critical failure inside general/alive.js execution tree:`, commandException.message);
        
        try {
            await sock.sendMessage(remoteJid, { 
                text: `\`\`System health check anomaly detected. Framework safe-mode enforced.\`\`` 
            }, { 
                quoted: msg 
            });
        } catch (secondaryFault) {
            console.error(`[Command Fatal] Emergency reporting pipe severed:`, secondaryFault.message);
        }
    }
}
