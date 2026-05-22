module.exports = { 
    config: commandConfig, 
    execute: executeAutonomousCommand 
};

/**
 * Metadata Configuration Block for Dynamic System Menu Generation
 */
const commandConfig = {
    name: 'setname',
    alias: ['botname'],
    category: 'settings',
    description: 'Update the bot name in real-time without restart.'
};

/**
 * Bot Name Update Command Node
 */
async function executeAutonomousCommand(ctx) {
    const { sock, msg, from, state, args, isOwner } = ctx;

    try {
        if (!isOwner) {
            return await ctx.reply('Access Denied. Only the owner can change settings.');
        }

        const newName = args.join(' ').trim();
        if (!newName) {
            return await ctx.reply(`Usage: ${state.prefix}setname <new_name>\nExample: ${state.prefix}setname Bunny Pro`);
        }

        // Update via StateManager - it handles Supabase + realtime
        const success = await state.updateSetting('bot_name', newName);
        
        if (!success) {
            return await ctx.reply('Failed to update bot name. Check database connection.');
        }

        await sock.sendMessage(from, {
            react: { text: '🐉', key: msg.key }
        });

        const successPayload = 
`╭─⌈ ⚙️ *Settings Updated* ⌋
│ Bot name changed to: ${newName}
│ Status: Applied instantly
╰⊷ *${newName}*`;

        await sock.sendMessage(from, { 
            text: successPayload 
        }, { 
            quoted: msg 
        });

    } catch (commandException) {
        console.error(`[Command Exception] Critical failure inside settings/setname.js execution tree:`, commandException.message);
        await ctx.reply('Failed to update bot name. Check database connection.');
    }
}