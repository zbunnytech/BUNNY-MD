import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import makeWASocket, { 
    DisconnectReason, 
    BufferJSON
} from '@whiskeysockets/baileys'; 

// Setup path resolution for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express, Server, and Environment Details
const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SERVER_ID = process.env.SERVER_ID || 'Render_Alpha';
const MAX_BOT_CONNECTIONS = 1; // Locked for a single standalone user profile

// Local static configuration profile mapping (Bypassing Supabase completely)
const localConfig = {
    bot_name: 'Bunny MD',
    bot_footer: 'Powered by Bunny Tech',
    prefix: '.',
    owner_name: 'Lupin Starnley',
    bot_pic: 'https://i.ibb.co/LDMjMYyy/file-00000000855c71f89fb70f5f8bebc2b2.png',
    update_channel_jid: '120363426850850275@newsletter'
};

// Cache tracking system to prevent high RAM consumption
const activeInstances = new Map();
const SESSION_FILE_PATH = path.join(__dirname, 'session.json');

// Serve the static pairing panel from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Redirect main URL directly to the pairing panel to fix 'Cannot GET /'
app.get('/', (req, res) => {
    res.redirect('/pair');
});

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

/**
 * Main Orchestrator to spin up a single dynamic WhatsApp Bot Instance
 * Powered entirely via Pristine Local Disk/RAM Sessions
 */
async function startBotInstance(botId, isNewConnection = false, injectedCreds = null) {
    if (activeInstances.has(botId)) {
        console.log(`[System] Instance ${botId} already running.`);
        return;
    }

    console.log(`[System] Initializing Standalone WhatsApp Client for ID: ${botId}...`);

    let masterCreds = {};

    // 1. Resolve Credentials mapping either from Direct Socket injection or Local Storage file
    if (injectedCreds) {
        masterCreds = injectedCreds;
        // Back up to local storage instantly to guarantee seamless standalone restarts
        fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify({ botId, creds: masterCreds }, BufferJSON.replacer));
    } else if (fs.existsSync(SESSION_FILE_PATH)) {
        try {
            const rawFileData = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
            const parsedData = JSON.parse(rawFileData, BufferJSON.reviver);
            masterCreds = parsedData.creds;
        } catch (err) {
            console.error('[Auth Profile] Local file corruption detected. Awaiting secure pairing setup:', err.message);
            return;
        }
    } else {
        console.log(`[Auth Profile] Pristine state setup tracking active. Manual setup required via web portal.`);
        return;
    }

    // Ephemeral Runtime State Bridge matching Baileys internal keys tracker
    const memoryAuthState = {
        creds: masterCreds,
        keys: {
            get: (type, ids) => {
                const data = {};
                for (const id of ids) {
                    data[id] = masterCreds[type]?.[id];
                }
                return data;
            },
            set: (data) => {
                for (const type in data) {
                    for (const id in data[type]) {
                        if (!masterCreds[type]) masterCreds[type] = {};
                        if (data[type][id] === null) {
                            delete masterCreds[type][id];
                        } else {
                            masterCreds[type][id] = data[type][id];
                        }
                    }
                }
            }
        }
    };

    // Initialize Baileys connection profile explicitly utilizing stable memory structures with desktop masquerade
    const sock = makeWASocket({
        auth: {
            creds: memoryAuthState.creds,
            keys: memoryAuthState.keys
        },
        printQRInTerminal: false,
        mobile: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    activeInstances.set(botId, sock);

    // Dynamic Module Hooking for Real-Time execution pipelines
    const routerPath = path.join(__dirname, 'lib', 'router.js');
    const cachePath = path.join(__dirname, 'lib', 'cache.js');

    sock.ev.on('creds.update', () => {
        // Automatically save updated session keys straight into local host partition
        fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify({ botId, creds: memoryAuthState.creds }, BufferJSON.replacer));
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;
            
            // Bypass internal network self-healing restarts from WhatsApp to avoid instance dropping loops
            if (reason === 515 || reason === DisconnectReason.restartRequired) {
                console.log(`[Connection Intercept] Soft hot-restart signaled by network for ${botId}. Safeguarding runtime reference.`);
                return;
            }

            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            console.log(`[Connection] Instance ${botId} severed. Reason: ${reason}. Reconnecting status: ${shouldReconnect}`);

            activeInstances.delete(botId);

            if (shouldReconnect) {
                startBotInstance(botId);
            } else {
                console.log(`[Connection Warning] Global Logout detected. Clearing out session files completely.`);
                if (fs.existsSync(SESSION_FILE_PATH)) {
                    fs.unlinkSync(SESSION_FILE_PATH);
                }
            }
        } else if (connection === 'open') {
            console.log(`[Success] Standalone Instance ${botId} safely linked to WhatsApp Network.`);

            // Backup active setup sync to avoid registration gaps
            fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify({ botId, creds: memoryAuthState.creds }, BufferJSON.replacer));

            // Execution sequence for required channel integration rules
            try {
                const targetNewsletterJid = localConfig.update_channel_jid;
                await sock.newsletterFollow(targetNewsletterJid);

                // Push success notification layout upon onboarding validation
                if (isNewConnection) {
                    const cleanUserNumber = botId.split(':')[0];
                    const userName = sock.user.name || 'Esteemed User';

                    const notificationMessage = 
`╭─⌈ *${localConfig.bot_name}* ⌋
│
│ Hello ${userName}, dynamic system onboarding has completed successfully.
│ Your automation instance is now active and fully protected by local memory.
│
╰⊷ \`\`\`${localConfig.bot_footer}\`\`\`

╭─⌈ *CONFIGURATION OVERVIEW* ⌋
│
╰⊷ Prefix Strategy: \`\`\`${localConfig.prefix}\`\`\`
╰⊷ System Persona: *${localConfig.bot_name}*
╰⊷ Core Architect: *${localConfig.owner_name}*
│
╰⊷ _Type *${localConfig.prefix}menu* inside any conversation to view features._`;

                    await sock.sendMessage(`${cleanUserNumber}@s.whatsapp.net`, { 
                        text: notificationMessage,
                        contextInfo: {
                            externalAdReply: {
                                title: localConfig.bot_name,
                                body: localConfig.bot_footer,
                                previewType: 'PHOTO',
                                thumbnailURL: localConfig.bot_pic,
                                sourceUrl: 'https://bunny-bot.mooo.com/pair'
                            }
                        }
                    });
                }

            } catch (forcedJoinError) {
                console.error(`[Security Warning] Critical community alignment failed for ${botId}:`, forcedJoinError.message);
            }
        }
    });

    // Event routing hook directly forwarding payload arrays to router layer
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        if (fs.existsSync(routerPath)) {
            const { routeMessagePipeline } = await import(`${routerPath}?update=${Date.now()}`);
            routeMessagePipeline(sock, chatUpdate, SERVER_ID, botId, cachePath);
        }
    });

    // Intercept update actions and route straight into targeted external observers directory
    sock.ev.on('messages.update', async (messageUpdates) => {
        const observerFile = path.join(__dirname, 'observers', 'antiDelete.js');
        if (fs.existsSync(observerFile)) {
            const { runAntiDeleteObserver } = await import(`${observerFile}?update=${Date.now()}`);
            runAntiDeleteObserver(sock, messageUpdates, SERVER_ID, botId);
        }
    });
}

/**
 * Core Initialization System Task
 * Invoked automatically upon Render framework launch signals
 */
function synchronizeClusterNode() {
    console.log(`[Cluster Startup] Initializing local standalone engine assigned to cluster profile: ${SERVER_ID}`);

    if (fs.existsSync(SESSION_FILE_PATH)) {
        try {
            const rawFileData = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
            const parsedData = JSON.parse(rawFileData, BufferJSON.reviver);
            if (parsedData && parsedData.botId) {
                console.log(`[Cluster Startup] Active local configuration found for ${parsedData.botId}. Booting instance...`);
                startBotInstance(parsedData.botId, false);
            }
        } catch (err) {
            console.error('[Cluster Startup Fatal] Failed to read cached registration session:', err.message);
        }
    } else {
        console.log('[Cluster Startup] Zero operational bot instances configured for this local node target ID.');
    }
}

// WebSocket connection broker layer linking index process tasks directly to folder files
if (fs.existsSync(path.join(__dirname, 'socket', 'socket.js'))) {
    import('./socket/socket.js').then(({ bindSocketRoutingEngine }) => {
        bindSocketRoutingEngine(io, startBotInstance, SERVER_ID, MAX_BOT_CONNECTIONS);
    });
}

// Start Express Listener and trigger cluster discovery execution loops
server.listen(PORT, () => {
    console.log(`[Server Core] Engine running on public dynamic web port allocation [:${PORT}]`);
    synchronizeClusterNode();
});

// Process isolation crash safeguards keeping instances secure
process.on('uncaughtException', (err) => {
    console.error('[Critical Engine Catch] System runtime error detected safely: ', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Promise Guard] Rejected promise event mitigated safely at: ', reason);
});
