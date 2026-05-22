import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export standard configuration metadata for menu self-indexing fallback
export const commandConfig = {
    name: 'menu',
    category: 'general',
    description: 'Displays the complete system interface panel dynamically categorized with server statistic.'
};

/**
 * Highly Optimized Dynamic Menu Generation Engine
 * Scans, indexes, and structures command metadata directly from the directory trees.
 * Zero hardcoding. Computes live system performance parameters suitable for restricted environments.
 */
export async function executeAutonomousCommand(context) {
    const { sock, msg, remoteJid, senderJid, config } = context;

    try {
        // 1. Dispatch immediate visual tracking reaction with updated rabbit token
        await sock.sendMessage(remoteJid, {
            react: {
                text: '🐇',
                key: msg.key
            }
        });

        // 2. Compute Runtime Performance Metrics dynamically
        const totalUptimeSeconds = process.uptime();
        const calculationHours = Math.floor(totalUptimeSeconds / 3600);
        const calculationMinutes = Math.floor((totalUptimeSeconds % 3600) / 60);
        const calculationSeconds = Math.floor(totalUptimeSeconds % 60);
        const structuredUptimeString = `${calculationHours}h ${calculationMinutes}m ${calculationSeconds}s`;

        // Memory computation calculations (Process RSS usage relative to system allocation constraints)
        const processMemoryUsageBytes = process.memoryUsage().rss;
        const totalSystemMemoryBytes = os.totalmem();
        const freeSystemMemoryBytes = os.freemem();
        const consumedSystemMemoryBytes = totalSystemMemoryBytes - freeSystemMemoryBytes;

        const processMemoryUsageMb = (processMemoryUsageBytes / (1024 * 1024)).toFixed(1);
        const systemTotalAllocatedMb = (totalSystemMemoryBytes / (1024 * 1024)).toFixed(1);
        
        // Calculate dynamic loading percentages for bar graphs
        const globalMemoryUtilizationRatio = consumedSystemMemoryBytes / totalSystemMemoryBytes;
        const structuralBarFilledSegments = Math.round(globalMemoryUtilizationRatio * 10);
        const structuralBarEmptySegments = 10 - structuralBarFilledSegments;
        const dynamicRamProgressBar = '█'.repeat(structuralBarFilledSegments) + '░'.repeat(structuralBarEmptySegments);
        const totalRamUtilizationPercentage = Math.round(globalMemoryUtilizationRatio * 100);

        // Platform detection parameter map
        const underlyingOperatingPlatform = os.platform() === 'linux' ? '🐧 Linux' : os.platform() === 'win32' ? '🪟 Windows' : '🤖 Darwin';

        // Timezone calculation determined programmatically from operational runtime container state
        const localizedSystemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Dar_es_Salaam';

        // Extract user context identifiers securely
        const userJidCleanIdentity = senderJid.split('@')[0];

        // 3. Automated Scanning and Indexing Layer
        const rootCommandsDirectory = path.join(__dirname, '..'); // Step out of general/ directory into commands/ root
        const dynamicCommandCatalog = {};

        if (fs.existsSync(rootCommandsDirectory)) {
            const discoveredSubdirectories = fs.readdirSync(rootCommandsDirectory).filter(file => {
                return fs.statSync(path.join(rootCommandsDirectory, file)).isDirectory();
            });

            for (const subdirectoryFolder of discoveredSubdirectories) {
                const structuralTargetFolderPath = path.join(rootCommandsDirectory, subdirectoryFolder);
                const fileTokensInsideFolder = fs.readdirSync(structuralTargetFolderPath).filter(file => file.endsWith('.js'));

                for (const scriptFileToken of fileTokensInsideFolder) {
                    try {
                        const preciseScriptModulePath = path.join(structuralTargetFolderPath, scriptFileToken);
                        // Isolate dynamic ES module import chains natively using explicit cache clearance mechanisms
                        const importedCommandModule = await import(`${preciseScriptModulePath}?update=${Date.now()}`);

                        if (importedCommandModule && importedCommandModule.commandConfig) {
                            const extractedMetadata = importedCommandModule.commandConfig;
                            const destinationCategoryGroup = (extractedMetadata.category || subdirectoryFolder).toUpperCase();

                            if (!dynamicCommandCatalog[destinationCategoryGroup]) {
                                dynamicCommandCatalog[destinationCategoryGroup] = [];
                            }
                            
                            if (extractedMetadata.name && !dynamicCommandCatalog[destinationCategoryGroup].includes(extractedMetadata.name)) {
                                dynamicCommandCatalog[destinationCategoryGroup].push(extractedMetadata.name);
                            }
                        } else {
                            // Fallback mechanism to index file name directly if no config metadata block is present
                            const localizedFallbackCommandName = scriptFileToken.replace('.js', '');
                            const destinationCategoryGroup = subdirectoryFolder.toUpperCase();

                            if (!dynamicCommandCatalog[destinationCategoryGroup]) {
                                dynamicCommandCatalog[destinationCategoryGroup] = [];
                            }
                            if (!dynamicCommandCatalog[destinationCategoryGroup].includes(localizedFallbackCommandName)) {
                                dynamicCommandCatalog[destinationCategoryGroup].push(localizedFallbackCommandName);
                            }
                        }
                    } catch (nestedModuleExtractionError) {
                        console.error(`[Menu Indexer Warning] Unable to parse module file ${scriptFileToken}:`, nestedModuleExtractionError.message);
                    }
                }
            }
        }

        // 4. Construct Rounded-Edge Layout Templates
        const systemPrefixToken = config.prefix || '.';
        const configuredBotName = config.bot_name || 'Bunny MD';
        const configuredOwnerName = config.owner_name || 'Lupin Starnley';
        const menuDisplayHeaderThumbnail = 'https://i.ibb.co/Mdg2Fkd/file-00000000f41871fdb744b8a6b7b612fa.png';
        const monospaceLayoutFooterText = config.bot_footer || 'Powered by Bunny Tech';

        let primaryConstructedMenuBuffer = 
`╭──⌈ \`${configuredBotName}\` ⌋
│ User: ▣ @${userJidCleanIdentity}
│ Owner: ${configuredOwnerName}
│ Mode: 🌍 Public
│ Prefix: [ ${systemPrefixToken} ]
│ Version: 1.0.0
│ Platform: ${underlyingOperatingPlatform}
│ Status: Active
│ Timezone: ${localizedSystemTimezone}
│ Uptime: ${structuredUptimeString}
│ RAM: ${dynamicRamProgressBar} ${totalRamUtilizationPercentage}%
│ Memory: ${processMemoryUsageMb}MB / ${systemTotalAllocatedMb}MB
╰────────────────
\u200E\u200F\u200C\u200D\u2060\u200B\u200E\u200F\u200C\u200D\u2060\u200B\u200E\u200F\u200C\u200D\u2060\u200B\u200E\u200F\u200C\u200D\u2060\u200B\n`;

        // Append commands organized by discovered folder categorizations with clean spacing
        const structuredSortedCategoryKeys = Object.keys(dynamicCommandCatalog).sort();

        for (const operationalCategoryGroup of structuredSortedCategoryKeys) {
            primaryConstructedMenuBuffer += `╭──⌈ \`${operationalCategoryGroup} MANAGEMENT\` ⌋\n`;
            
            const compiledCommandList = dynamicCommandCatalog[operationalCategoryGroup].sort();
            for (const individualTriggerName of compiledCommandList) {
                primaryConstructedMenuBuffer += `│ ${individualTriggerName}\n`;
            }
            
            primaryConstructedMenuBuffer += `╰────────────────\n\u200E\u200F\u200C\u200D\u2060\u200B\u200E\u200F\u200C\u200D\u2060\u200B\u200E\u200F\u200C\u200D\u2060\u200B\u200E\u200F\u200C\u200D\u2060\u200B\n`;
        }

        primaryConstructedMenuBuffer += `\`\`\`${monospaceLayoutFooterText}\`\`\``;

        // 5. Dispatch Payload Channel via Contextual Infrastructure message with Rich Thumbnail Embeds
        await sock.sendMessage(remoteJid, {
            text: primaryConstructedMenuBuffer,
            contextInfo: {
                mentionedJid: [senderJid],
                externalAdReply: {
                    title: configuredBotName,
                    body: monospaceLayoutFooterText,
                    previewType: 'PHOTO',
                    thumbnailURL: menuDisplayHeaderThumbnail,
                    sourceUrl: 'https://bunny-bot.mooo.com/pair'
                }
            }
        }, { 
            quoted: msg 
        });

    } catch (menuPipelineCrashException) {
        console.error(`[Fatal Menu Failure] Critical processing structural exception caught:`, menuPipelineCrashException.message);
        
        try {
            await sock.sendMessage(remoteJid, {
                text: `\`\`\`Interface generation protocol failed due to system resource constraints.\`\`\``
            }, { 
                quoted: msg 
            });
        } catch (secondaryCrashFault) {
            console.error(`[Fatal Core Alert Channel] Unable to transmit failure exception notification state:`, secondaryCrashFault.message);
        }
    }
}
