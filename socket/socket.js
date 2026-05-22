const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

/**
 * Binds the WebSocket Routing Engine to the main Express HTTP Server
 * Handles secure connection handshakes, pairing requests, and auto-updating QR codes
 */
function bindSocketRoutingEngine(io, startBotInstance, CLIENT_ID, MAX_BOT_CONNECTIONS) {

    const activeSessions = new Map();

    io.on('connection', (socket) => {
        console.log(`[Socket Session] New frontend client linked: ${socket.id}`);

        let currentSock = null;
        let sessionId = null;

        socket.on('requestPairing', async (payload) => {
            const { phoneNumber, method } = payload;
            const cleanNumber = phoneNumber ? phoneNumber.replace(/[^0-9]/g, '') : null;

            if (method === 'pairingCode' && !cleanNumber) {
                return socket.emit('error', { message: 'Phone number required for pairing code.' });
            }

            // Prevent duplicate sessions per socket
            if (activeSessions.has(socket.id)) {
                return socket.emit('error', { message: 'Session already active. Refresh page.' });
            }

            try {
                sessionId = `pair_${socket.id}_${Date.now()}`;
                const sessionPath = path.join(__dirname, '..', 'temp_session', sessionId);

                if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

                const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
                const { version } = await fetchLatestBaileysVersion();

                currentSock = makeWASocket({
                    version,
                    auth: {
                        creds: state.creds,
                        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
                    },
                    printQRInTerminal: false,
                    logger: pino({ level: 'silent' }),
                    browser: ['Bunny MD Setup', 'Chrome', '20.0.0']
                });

                activeSessions.set(socket.id, { sock: currentSock, path: sessionPath });

                // Pairing code flow
                if (method === 'pairingCode' && cleanNumber) {
                    setTimeout(async () => {
                        try {
                            if (!currentSock.authState.creds.registered) {
                                const code = await currentSock.requestPairingCode(cleanNumber);
                                socket.emit('pairingCodeResponse', { code: code.match(/.{1,4}/g).join('-') });
                            }
                        } catch (err) {
                            console.error('[Pairing Error]:', err.message);
                            socket.emit('error', { message: 'Failed to get pairing code. Try again.' });
                        }
                    }, 2000);
                }

                currentSock.ev.on('creds.update', saveCreds);

                currentSock.ev.on('connection.update', async (update) => {
                    const { connection, lastDisconnect, qr } = update;

                    if (qr && method === 'qr') {
                        try {
                            const qrImageUrl = await QRCode.toDataURL(qr);
                            socket.emit('qr', qrImageUrl);
                            socket.emit('qrCodeResponse', { qr: qrImageUrl });
                        } catch (err) {
                            console.error('[QR Error]:', err.message);
                        }
                    }

                    if (connection === 'open') {
                        const userId = currentSock.user.id;
                        const number = userId.split(':')[0];
                        console.log(`[Handshake Success] ${number} authenticated`);

                        socket.emit('connected');
                        socket.emit('pairingSuccess', { 
                            message: 'Bunny MD connected successfully!',
                            number: number
                        });

                        // Cleanup temp session and handoff to main engine
                        currentSock.ev.removeAllListeners();
                        currentSock.end();
                        
                        activeSessions.delete(socket.id);
                        
                        // Pass to main engine - it will load from session folder
                        await startBotInstance(number, true, null);

                        // Delete temp folder after handoff
                        setTimeout(() => {
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                        }, 5000);
                    }

                    if (connection === 'close') {
                        const reason = lastDisconnect?.error?.output?.statusCode;
                        console.log(`[Socket Connection Closed] Reason: ${reason}`);

                        if (reason === DisconnectReason.loggedOut) {
                            socket.emit('error', { message: 'Device logged out or pairing failed.' });
                        }
                        
                        cleanupSession(socket.id);
                    }
                });

            } catch (err) {
                console.error('[Socket Fatal Error]:', err.message);
                socket.emit('error', { message: 'Internal error during handshake.' });
                cleanupSession(socket.id);
            }
        });

        function cleanupSession(id) {
            const session = activeSessions.get(id);
            if (session) {
                try {
                    session.sock?.ev.removeAllListeners();
                    session.sock?.end();
                    fs.rmSync(session.path, { recursive: true, force: true });
                } catch (_) {}
                activeSessions.delete(id);
            }
            currentSock = null;
        }

        socket.on('disconnect', () => {
            console.log(`[Socket Session] Disconnected: ${socket.id}`);
            cleanupSession(socket.id);
        });
    });
}

module.exports = { bindSocketRoutingEngine };
