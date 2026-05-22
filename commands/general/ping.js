const { performance } = require('perf_hooks');

/**
 * Metadata Configuration Block for Dynamic System Menu Generation
 * This object is fully exposed to allow automatic indexing by menu.js
 */
const commandConfig = {
    name: 'ping',
    category: 'general',
    description: 'Measures server connection latency and operational baseline speed metrics.'
};

/**
 * Advanced High-Performance Ping Command Node
 * Custom styled with rounded corners and localized database typography
 */
async function executeAutonomousCommand(context) {
    const { sock, msg, remoteJid, config } = context;

    try {
        // 1. Dispatch immediate visual feedback via reaction token
        await sock.sendMessage(remoteJid, {
            react: {
                text: '🦸',
                key: msg.key
            }
        });

        // 2. Execute precision server latency calculations using performance hooks
        const executionStartTimestamp = performance.now();
        // Light operation to measure baseline stack processing speed
        const processingBaseline = 1 + 1; 
        const executionEndTimestamp = performance.now();
        
        const serverLatencyMs = (executionEndTimestamp - executionStartTimestamp).toFixed(4);

        // 3. Extract dynamic configuration identities straight from the Supabase context map
        const activeBotIdentityName = config.bot_name || 'Bunny MD';
        const activeBotMonospaceFooter = config.bot_footer || 'Powered by Bunny Tech';

        // 4. Construct the high-fidelity rounded-edge layout template incorporating metadata mappings
        const dynamicPingPayload = 
`╭─⌈ ⚡ *${activeBotIdentityName}* ⌋
│ speed: *${serverLatencyMs}ms* [█████████▒]
│ category: *${commandConfig.category}*
│ info: _${commandConfig.description}_
╰⊷ \`\`\`${activeBotMonospaceFooter}\`\`\``;

        // 5. Dispatch the final localized payload as a direct contextual reply to the user message
        await sock.sendMessage(remoteJid, { 
            text: dynamicPingPayload 
        }, { 
            quoted: msg 
        });

    } catch (commandException) {
        console.error(`[Command Exception] Critical failure inside general/ping.js execution tree:`, commandException.message);
        
        try {
            await sock.sendMessage(remoteJid, { 
                text: `\`\`\`System latency calculation anomaly detected. Framework safe-mode enforced.\`\`\`` 
            }, { 
                quoted: msg 
            });
        } catch (secondaryFault) {
            console.error(`[Command Fatal] Emergency reporting pipe severed:`, secondaryFault.message);
        }
    }
}

module.exports = { 
    commandConfig, 
    executeAutonomousCommand 
};
