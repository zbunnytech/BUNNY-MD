module.exports = {
    commandConfig,
    executeAutonomousCommand
};

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

/**
 * Metadata Configuration Block for Dynamic System Menu Generation
 */
const commandConfig = {
    name: 'menu',
    category: 'general',
    description: 'Displays the complete system interface panel dynamically categorized with server statistic.'
};

/**
 * Highly Optimized Dynamic Menu Generation Engine
 */
async function executeAutonomousCommand(context) {
    const { sock, msg, remoteJid, senderJid, config } = context;

    try {
        await sock.sendMessage(remoteJid, { react: { text: '🐇', key: msg.key } });

        const totalUptimeSeconds = process.uptime();
        const calculationHours = Math.floor(totalUptimeSeconds / 3600);
        const calculationMinutes = Math.floor((totalUptimeSeconds % 3600) / 60);
        const calculationSeconds = Math.floor(totalUptimeSeconds % 60);
        const structuredUptimeString = `${calculationHours}h ${calculationMinutes}m ${calculationSeconds}s`;

        const processMemoryUsageMb = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);
        const totalSystemMemoryBytes = os.totalmem();
        const freeSystemMemoryBytes = os.freem();
        const globalMemoryUtilizationRatio = (totalSystemMemoryBytes - freeSystemMemoryBytes) / totalSystemMemoryBytes;
        const dynamicRamProgressBar = '█'.repeat(Math.round(globalMemoryUtilizationRatio * 10)) + '░'.repeat(10 - Math.round(globalMemoryUtilizationRatio * 10));
        const totalRamUtilizationPercentage = Math.round(globalMemoryUtilizationRatio * 100);

        const underlyingOperatingPlatform = os.platform() === 'linux'? '🐧 Linux' : '🪟 Windows';
        const userIdentity = senderJid.split('@')[0];

        const rootCommandsDirectory = path.join(__dirname, '..');
        const dynamicCommandCatalog = {};

        if (fs.existsSync(rootCommandsDirectory)) {
            const discoveredSubdirectories = fs.readdirSync(rootCommandsDirectory).filter(file => fs.statSync(path.join(rootCommandsDirectory, file)).isDirectory());

            for (const subdirectoryFolder of discoveredSubdirectories) {
                const structuralTargetFolderPath = path.join(rootCommandsDirectory, subdirectoryFolder);
                const fileTokensInsideFolder = fs.readdirSync(structuralTargetFolderPath).filter(file => file.endsWith('.js'));

                for (const scriptFileToken of fileTokensInsideFolder) {
                    try {
                        const preciseScriptModulePath = path.join(structuralTargetFolderPath, scriptFileToken);
                        const importedCommandModule = require(preciseScriptModulePath);

                        const category = (importedCommandModule.commandConfig?.category || subdirectoryFolder).toUpperCase();
                        if (!dynamicCommandCatalog[category]) dynamicCommandCatalog[category] = [];

                        const cmdName = importedCommandModule.commandConfig?.name || scriptFileToken.replace('.js', '');
                        if (!dynamicCommandCatalog[category].includes(cmdName)) {
                            dynamicCommandCatalog[category].push(cmdName);
                        }
                    } catch (e) { continue; }
                }
            }
        }

        const systemPrefixToken = config.prefix || '.';
        const configuredBotName = config.bot_name || 'Bunny MD';
        const configuredOwnerName = config.owner_name || 'Lupin Starnley';
        const footerText = config.bot_footer || 'Powered by Bunny Tech';

        let primaryConstructedMenuBuffer =
`╭──⌈ ${configuredBotName} ⌋
│ User: ${userIdentity}
│ Owner: ${configuredOwnerName}
│ Prefix: [ ${systemPrefixToken} ]
│ Platform: ${underlyingOperatingPlatform}
│ Uptime: ${structuredUptimeString}
│ RAM: ${dynamicRamProgressBar} ${totalRamUtilizationPercentage}%
╰────────────────\n\n`;

        for (const cat of Object.keys(dynamicCommandCatalog).sort()) {
            primaryConstructedMenuBuffer += `╭──⌈ ${cat} MANAGEMENT ⌋\n`;
            dynamicCommandCatalog[cat].sort().forEach(cmd => { primaryConstructedMenuBuffer += `│ ${cmd}\n`; });
            primaryConstructedMenuBuffer += `╰────────────────\n\n`;
        }

        primaryConstructedMenuBuffer += `${footerText}`;

        const tempImagePath = path.join(os.tmpdir(), 'menu_temp.png');
        const imgResponse = await axios({ url: 'https://i.ibb.co/Mdg2Fkd/file-00000f41871fdb744b8a6b7b612fa.png', responseType: 'arraybuffer' });
        fs.writeFileSync(tempImagePath, Buffer.from(imgResponse.data, 'binary'));

        await sock.sendMessage(remoteJid, {
            image: { url: tempImagePath },
            caption: primaryConstructedMenuBuffer
        }, { quoted: msg });

        if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);

    } catch (e) {
        console.error("Menu Error:", e.message);
    }
}
