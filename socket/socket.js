const {
    default: makeWASocket,
    DisconnectReason,
    BufferJSON
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require("qrcode");

// Mfumo wa kutengeneza Pristine Credentials kienyeji kwa Baileys ya zamani
const initAuthCreds = () => {
    return {
        noiseKey: Crypto.generateKeyPair(),
        signedIdentityKey: Crypto.generateKeyPair(),
        signedPreKey: Crypto.generateKeyPair(),
        registrationId: Math.floor(Math.random() * 16384) + 1,
        advSecretKey: Buffer.alloc(32).toString('base64'),
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSettings: { unarchiveChats: false },
        myAppStateKeyId: null
    };
};

// Kwa sababu initAuthCreds haipo direct exported kwenye Baileys ya zamani, tunatumia Crypto au backup ya vitu vya msingi vya Baileys
const Crypto = require("@whiskeysockets/baileys/lib/Utils/crypto");

/**
 * Binds the WebSocket Routing Engine to the main Express HTTP Server
 * Handles secure connection handshakes, pairing requests, and auto-updating QR codes
 * Powered entirely by CommonJS for Bunny MD Architecture
 */
function bindSocketRoutingEngine(io, startBotInstance, CLIENT_ID, MAX_BOT_CONNECTIONS) {

    io.on('connection', (socket) => {
        console.log(`[Socket Session] New frontend client linked: ${socket.id}`);

        // Track active connection process for this specific socket session to prevent leaks
        let currentSock = null;

        /**
         * Triggered when a user requests initialization (either QR or Pairing Code) from pair.html
         */
        socket.on('requestPairing', async (payload) => {
            const { phoneNumber, method } = payload; // method can be 'qr' or 'pairingCode'

            // Clean phone number format if provided
            const cleanNumber = phoneNumber ? phoneNumber.replace(/[^0-9]/g, '') : null;

            if (method === 'pairingCode' && !cleanNumber) {
                return socket.emit('error', { message: 'A valid WhatsApp phone number is strictly required for pairing code authentication.' });
            }

            const botId = cleanNumber ? `${cleanNumber}:0` : null;

            try {
                // Safely clear old socket instance before opening a new stream pipeline
                if (currentSock) {
                    try { 
                        currentSock.ev.removeAllListeners('connection.update');
                        currentSock.end(); 
                    } catch (_) {}
                }

                console.log(`[Socket Engine] Initializing WhatsApp instance via [${method}] for Standalone Bunny MD Node`);

                // Pure In-Memory Authentication Mappings (Completely independent init)
                const { initAuthCreds: baileysInitCreds } = require("@whiskeysockets/baileys/lib/Utils/auth-utils");
                const pristineCreds = baileysInitCreds ? baileysInitCreds() : initAuthCreds();
                
                const ephemeralAuthState = {
                    creds: pristineCreds,
                    keys: {
                        get: (type, ids) => {
                            const data = {};
                            for (const id of ids) {
                                data[id] = pristineCreds[type]?.[id];
                            }
                            return data;
                        },
                        set: (data) => {
                            for (const type in data) {
                                for (const id in data[type]) {
                                    if (!pristineCreds[type]) pristineCreds[type] = {};
                                    if (data[type][id] === null) {
                                        delete pristineCreds[type][id];
                                    } else {
                                        pristineCreds[type][id] = data[type][id];
                                    }
                                }
                            }
                        }
                    }
                };

                // Initialize core parameters utilizing fully hardened browser identity string masks
                currentSock = makeWASocket({
                    auth: {
                        creds: ephemeralAuthState.creds,
                        keys: ephemeralAuthState.keys
                    },
                    printQRInTerminal: false,
                    logger: pino({ level: 'silent' }),
                    browser: ['Bunny MD Setup', 'Chrome', '20.0.0']
                });

                // Request pairing sequence if explicitly specified by user layout choice
                if (method === 'pairingCode' && cleanNumber) {
                    setTimeout(async () => {
                        try {
                            const pairingCode = await currentSock.requestPairingCode(cleanNumber);
                            socket.emit('pairingCodeResponse', { code: pairingCode });
                        } catch (pairingReqError) {
                            console.error('[Socket Engine Error] WhatsApp pairing request rejected:', pairingReqError.message);
                            socket.emit('error', { message: 'Failed to fetch pairing code from WhatsApp servers. Try again.' });
                        }
                    }, 3000);
                }

                currentSock.ev.on('creds.update', () => {
                    // Volatile engine updates state automatically
                });

                currentSock.ev.on('connection.update', async (update) => {
                    const { connection, lastDisconnect, qr } = update;

                    // Converts raw QR string to Base64 DataURL image string before broadcasting to frontend UI
                    if (qr && method === 'qr') {
                        try {
                            console.log(`[Socket Engine] Generating QR Image Matrix for client: ${socket.id}`);
                            const qrImageUrl = await QRCode.toDataURL(qr);
                            socket.emit('qr', qrImageUrl); // Classic VEX core bridge broadcast
                            socket.emit('qrCodeResponse', { qr: qrImageUrl }); // pair.html hook compatibility
                        } catch (qrGenErr) {
                            console.error('[QR Engine Error] Failed to compile matrix to base64 image:', qrGenErr.message);
                        }
                    }

                    if (connection === 'open') {
                        const finalBotId = botId || `${currentSock.user.id.split(':')[0]}:0`;
                        const authenticatedNumber = finalBotId.split(':')[0];

                        console.log(`[Handshake Success] ${authenticatedNumber} safely authenticated 100% in memory!`);

                        // COMPACT BASE64 BLOCK SYNC
                        const cloudPackData = JSON.stringify(ephemeralAuthState.creds, BufferJSON.replacer);

                        // Broadcast success event confirmation back to UI layers
                        socket.emit('connected'); // Classic VEX broadcast
                        socket.emit('pairingSuccess', { 
                            message: 'Bunny MD connected successfully! Check your WhatsApp chat for initialization reports.',
                            sessionCreds: cloudPackData
                        });

                        // Kill local registration listeners and pass execution tasks over to main index process cluster loop
                        currentSock.ev.removeAllListeners('connection.update');
                        currentSock = null;
                        
                        // Pass to index.js main engine runner directly with credentials included
                        await startBotInstance(finalBotId, true, ephemeralAuthState.creds);
                    }

                    if (connection === 'close') {
                        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;
                        console.log(`[Socket Engine Connection] Registration lifecycle closed. Reason code: ${reason}`);

                        if (reason === 515 || reason === DisconnectReason.restartRequired) {
                            console.log(`[Socket Engine Balance] Internal hot-restart signaled by WhatsApp network. Keeping stream pipeline warm.`);
                            return; 
                        }

                        if (reason === DisconnectReason.loggedOut) {
                            socket.emit('error', { message: 'Device pairing initialization was rejected or logged out.' });
                        }
                    }
                });

            } catch (fatalSocketErr) {
                console.error('[Socket Engine Fatal] Registration handler crashed:', fatalSocketErr.message);
                socket.emit('error', { message: 'Internal infrastructure error occurred during device handshake execution.' });
            }
        });

        // Fixed frontend disconnect logic to avoid blowing up active handshake registration flows
        socket.on('disconnect', () => {
            console.log(`[Socket Session] Client socket pipeline disconnected: ${socket.id}`);
            if (currentSock) {
                try {
                    currentSock.ev.removeAllListeners('connection.update');
                } catch (_) {}
                currentSock = null;
            }
        });
    });
}

module.exports = { bindSocketRoutingEngine };
