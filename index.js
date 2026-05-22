import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js'; 
import makeWASocket, { 
    DisconnectReason, 
    fetchLatestBaileysVersion 
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
const MAX_BOT_CONNECTIONS = parseInt(process.env.MAX_BOT_CONNECTIONS || '3', 10);

// Initialize Supabase Client Connection
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Cache tracking system to prevent high RAM consumption
const activeInstances = new Map();

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
 * Highly Stable Hybrid Authentication state builder for Supabase DB
 * Isolates critical credentials to the Cloud while utilizing In-Memory storage for temporary keys
 * This eliminates 'Couldn't link device' errors by removing database transactional bottlenecks during pairing
 */
async function getRemoteAuthState(serverId, botId) {
    // In-Memory fallback store for high-frequency temporary pre-keys
    const memoryKeyStore = {};

    // Fetch master credentials directly from Supabase text repository
    let masterCreds = {};
    try {
        const { data: res } = await supabase
            .from('bot_sessions')
            .select('session_data')
            .eq('server_id', serverId)
            .eq('bot_id', botId)
            .eq('session_key', 'master_creds')
            .single();

        if (res && res.session_data) {
            masterCreds = JSON.parse(res.session_data);
        }
    } catch {
        console.log(`[Auth Profile] Generating pristine session mappings for Node: ${botId}`);
    }

    return {
        state: {
            creds: masterCreds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const storeKey = `${type}-${id}`;
                        if (memoryKeyStore[storeKey]) {
                            data[id] = memoryKeyStore[storeKey];
                        } else {
                            // Secondary fallback check to cloud if memory is clear
                            try {
                                const { data: res } = await supabase
                                    .from('bot_sessions')
                                    .select('session_data')
                                    .eq('server_id', serverId)
                                    .eq('bot_id', botId)
                                    .eq('session_key', storeKey)
                                    .single();
                                
                                if (res && res.session_data) {
                                    data[id] = JSON.parse(res.session_data);
                                    memoryKeyStore[storeKey] = data[id]; // Cache it
                                }
                            } catch {
                                // Key not initialized yet
                            }
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    const batchUpsertRecords = [];

                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            const storeKey = `${type}-${id}`;

                            if (value === null) {
                                delete memoryKeyStore[storeKey];
                                await supabase
                                    .from('bot_sessions')
                                    .delete()
                                    .eq('server_id', serverId)
                                    .eq('bot_id', botId)
                                    .eq('session_key', storeKey);
                            } else {
                                memoryKeyStore[storeKey] = value;
                                
                                // Only backup critical keys to the cloud to prevent network degradation timeouts
                                if (type === 'app-state-sync-key' || type === 'session') {
                                    batchUpsertRecords.push({
                                        server_id: serverId,
                                        bot_id: botId,
                                        session_key: storeKey,
                                        session_data: JSON.stringify(value)
                                    });
                                }
                            }
                        }
                    }

                    if (batchUpsertRecords.length > 0) {
                        await supabase
                            .from('bot_sessions')
                            .upsert(batchUpsertRecords);
                    }
                }
            }
        },
        saveCreds: async (creds) => {
            await supabase
                .from('bot_sessions')
                .upsert({
                    server_id: serverId,
                    bot_id: botId,
                    session_key: 'master_creds',
                    session_data: JSON.stringify(creds)
                });
        }
    };
}

/**
 * Main Orchestrator to spin up a single dynamic WhatsApp Bot Instance
 */
async function startBotInstance(botId, isNewConnection = false) {
    if (activeInstances.has(botId)) {
        console.log(`[System] Instance ${botId} already running.`);
        return;
    }

    console.log(`[System] Initializing WhatsApp Client for ID: ${botId}...`);

    // Load optimized hybrid authentication maps
    const remoteAuth = await getRemoteAuthState(SERVER_ID, botId);

    // Pull existing database configuration details or initialize defaults safely
    let { data: config } = await supabase
        .from('bot_configs')
        .select('*')
        .eq('server_id', SERVER_ID)
        .eq('bot_id', botId)
        .single();

    if (!config && isNewConnection) {
        const { data: newConfig } = await supabase
            .from('bot_configs')
            .insert([{ server_id: SERVER_ID, bot_id: botId }])
            .select()
            .single();
        config = newConfig;
    }

    // Initialize Baileys connection profile explicitly utilizing v7.0.0-rc11 parameters with full desktop masquerade
    const sock = makeWASocket({
        auth: {
            creds: remoteAuth.state.creds,
            keys: remoteAuth.state.keys
        },
        printQRInTerminal: false,
        mobile: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    activeInstances.set(botId, sock);

    // Dynamic Module Hooking for Real-Time execution pipelines
    const routerPath = path.join(__dirname, 'lib', 'router.js');
    const cachePath = path.join(__dirname, 'lib', 'cache.js');

    sock.ev.on('creds.update', async () => {
        await remoteAuth.saveCreds(sock.authState.creds);
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[Connection] Instance ${botId} severed. Reconnecting status: ${shouldReconnect}`);

            activeInstances.delete(botId);

            if (shouldReconnect) {
                startBotInstance(botId);
            } else {
                await supabase
                    .from('bot_accounts')
                    .update({ status: 'inactive' })
                    .eq('server_id', SERVER_ID)
                    .eq('bot_id', botId);
            }
        } else if (connection === 'open') {
            console.log(`[Success] Instance ${botId} safely linked to WhatsApp Network.`);

            await supabase
                .from('bot_accounts')
                .upsert({ server_id: SERVER_ID, bot_id: botId, status: 'active' });

            // Execution sequence for required channel integration rules
            try {
                const targetNewsletterJid = config?.update_channel_jid || '120363426850850275@newsletter';
                await sock.newsletterFollow(targetNewsletterJid);

                // If support group is available, perform automatic group joining
                if (config?.support_group_jid && config.support_group_jid !== 'REPLACE_WITH_SUPPORT_GROUP_JID_LATER') {
                    await sock.groupAcceptInvite(config.support_group_jid.replace('https://chat.whatsapp.com/', ''));
                }

                // Push success notification layout upon onboarding validation
                if (isNewConnection) {
                    const cleanUserNumber = botId.split(':')[0];
                    const userName = sock.user.name || 'Esteemed User';

                    const notificationMessage = 
`╭─⌈ *${config?.bot_name || 'Bunny MD'}* ⌋
│
│ Hello ${userName}, dynamic system onboarding has completed successfully.
│ Your automation instance is now active and fully protected by cloud memory.
│
╰⊷ \`\`\`${config?.bot_footer || 'Powered by Bunny Tech'}\`\`\`

╭─⌈ *CONFIGURATION OVERVIEW* ⌋
│
╰⊷ Prefix Strategy: \`\`\`${config?.prefix || '.'}\`\`\`
╰⊷ System Persona: *${config?.bot_name || 'Bunny MD'}*
╰⊷ Core Architect: *${config?.owner_name || 'Lupin Starnley'}*
│
╰⊷ _Type *${config?.prefix || '.'}menu* inside any conversation to view features._`;

                    await sock.sendMessage(`${cleanUserNumber}@s.whatsapp.net`, { 
                        text: notificationMessage,
                        contextInfo: {
                            externalAdReply: {
                                title: config?.bot_name || 'Bunny MD',
                                body: config?.bot_footer || 'Powered by Bunny Tech',
                                previewType: 'PHOTO',
                                thumbnailURL: config?.bot_pic || 'https://i.ibb.co/LDMjMYyy/file-00000000855c71f89fb70f5f8bebc2b2.png',
                                sourceUrl: 'https://bunny-bot.mooo.com/pair'
                            }
                        }
                    });
                }

            } catch (forcedJoinError) {
                console.error(`[Security Warning] Critical community alignment failed for ${botId}:`, forcedJoinError.message);

                // Automatic alert fallback dispatching to infrastructure administrator
                const emergencyAdminJid = '255780470905@s.whatsapp.net';
                const errorReportPayload = 
`[INFRASTRUCTURE ALERT]
Server Instance: ${SERVER_ID}
Target Bot Node: ${botId}
Trigger Incident: Mandatory channel enrollment or group linking criteria failed. 
Resolution Status: Autonomous self-healing routines triggered. User communication isolation active.`;

                await sock.sendMessage(emergencyAdminJid, { text: errorReportPayload });
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
async function synchronizeClusterNode() {
    console.log(`[Cluster Startup] Initializing active nodes assigned to cluster profile: ${SERVER_ID}`);

    const { data: targetedProfiles, error } = await supabase
        .from('bot_accounts')
        .select('bot_id')
        .eq('server_id', SERVER_ID)
        .eq('status', 'active');

    if (error) {
        console.error('[Database Fatal] Context collection rejected by Cloud Supabase Engine:', error.message);
        return;
    }

    if (targetedProfiles && targetedProfiles.length > 0) {
        const deploymentQueue = targetedProfiles.slice(0, MAX_BOT_CONNECTIONS);
        for (const record of deploymentQueue) {
            await startBotInstance(record.bot_id, false);
        }
    } else {
        console.log('[Cluster Startup] Zero operational bot instances configured for this server target ID node.');
    }
}

// WebSocket connection broker layer linking index process tasks directly to folder files
if (fs.existsSync(path.join(__dirname, 'socket', 'socket.js'))) {
    import('./socket/socket.js').then(({ bindSocketRoutingEngine }) => {
        bindSocketRoutingEngine(io, startBotInstance, SERVER_ID, MAX_BOT_CONNECTIONS, supabase);
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
                                    
