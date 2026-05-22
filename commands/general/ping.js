module.exports = { 
    config: commandConfig, 
    execute: executeAutonomousCommand 
};

const { performance } = require('perf_hooks');

/**
 * Metadata Configuration Block for Dynamic System Menu Generation
 * This object is fully exposed to allow automatic indexing by menu.js
 */
const commandConfig = {
    name: 'ping',
    alias: ['p', 'speed'],
    category: 'general',
    description: 'Measures server connection latency and operational baseline speed metrics.'
};

/**
 * Advanced High-Performance Ping Command Node
 * Custom styled with rounded corners and localized database typography
 */
async function executeAutonomousCommand(ctx) {
    const { sock, msg, from, state } = ctx;

    try {
        // Reaction
        await sock.sendMessage(from, {
            react: {
                text: '🦸',
                key: msg.key
            }
        });

        const executionStartTimestamp = performance.now();
        const processingBaseline = 1 + 1; 
        const executionEndTimestamp = performance.now();

        const serverLatencyMs = (executionEndTimestamp - executionStartTimestamp).toFixed(0);
        const activeBotIdentityName = state.botName || 'Bunny MD';

        const dynamicPingPayload = 
`╭─⌈ ⚡ *${activeBotIdentityName}* ⌋
│ ${serverLatencyMs}ms [█████████▒]
╰⊷ *${activeBotIdentityName}*`;

        await sock.sendMessage(from, { 
            text: dynamicPingPayload 
        }, { 
            quoted: msg 
        });

    } catch (commandException) {
        console.error(`[Command Exception] Critical failure inside general/ping.js execution tree:`, commandException.message);

        try {
            await ctx.reply(`\`\`System latency calculation anomaly detected. Framework safe-mode enforced.\`\``);
        } catch (secondaryFault) {
            console.error(`[Command Fatal] Emergency reporting pipe severed:`, secondaryFault.message);
        }
    }
}