require("dotenv").config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ================= GLOBAL =================
global.prefix = ".";
global.botName = "Bunny MD";
global.ownerName = "Lupin Starnley";
global.clientId = process.env.CLIENT_ID || "BUNNY_DEFAULT";

// ================= CORE MAPPINGS =================
const router = require("./lib/router");
const cache = require("./lib/cache");

// ================= PATHS =================
const pluginPath = path.join(__dirname, "commands");
const observerPath = path.join(__dirname, "observers");

// ================= STORAGE =================
const commands = new Map();
const aliases = new Map();
const observers = [];

// ================= STATE FLAGS =================
let onboardingSent = false;
let isConnecting = false;
let reloadLock = false;

// ================= AUTO RELOAD ENGINE =================
function startAutoReload() {
    if (reloadLock) return;
    reloadLock = true;

    try {
        fs.watch(pluginPath, { persistent: true, recursive: true }, (event, file) => {
            if (file && file.endsWith(".js")) {
                console.log(`♻️ Command Layer changed: ${file}`);
                setTimeout(loadCommands, 500);
            }
        });

        fs.watch(observerPath, { persistent: true, recursive: true }, (event, file) => {
            if (file && file.endsWith(".js")) {
                console.log(`👁️ Observer Layer changed: ${file}`);
                setTimeout(loadObservers, 500);
            }
        });

        console.log("🔥 LAZY LOAD & AUTO RELOAD SYSTEM ACTIVE");
    } catch (e) {
        console.log("Lazy reload engine warning:", e.message);
    }
}

// ================= SERVER LAYER =================
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.redirect("/pair"));
app.get("/pair", (req, res) => res.sendFile(path.join(__dirname, "public", "pair.html")));

// ================= LOAD COMMANDS RECURSIVE =================
function loadCommands() {
    commands.clear();
    aliases.clear();

    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath, { recursive: true });

    const files = getAllJsFiles(pluginPath);

    for (const filePath of files) {
        try {
            delete require.cache[require.resolve(filePath)];
            const plugin = require(filePath);

            const name = plugin.commandConfig?.name || plugin.command || path.basename(filePath, ".js");

            if (plugin.commandConfig && plugin.executeAutonomousCommand) {
                commands.set(name, {
                    execute: plugin.executeAutonomousCommand,
                    config: plugin.commandConfig
                });
            } else if (plugin.execute) {
                commands.set(name, plugin);
            }

            if (Array.isArray(plugin.alias)) {
                for (const a of plugin.alias) {
                    aliases.set(a, name);
                }
            }
        } catch (e) {
            console.error(`Error loading command ${filePath}:`, e.message);
        }
    }
    console.log(`✅ ${commands.size} Commands Loaded`);
}

// ================= LOAD OBSERVERS RECURSIVE =================
function loadObservers() {
    observers.length = 0;

    if (!fs.existsSync(observerPath)) fs.mkdirSync(observerPath, { recursive: true });

    const files = getAllJsFiles(observerPath);

    for (const filePath of files) {
        try {
            delete require.cache[require.resolve(filePath)];
            const obs = require(filePath);
            if (obs.onMessage) observers.push(obs);
        } catch (e) {
            console.error(`Error loading observer ${filePath}:`, e.message);
        }
    }
    console.log(`👁️ ${observers.length} Observers Active`);
}

// ================= RECURSIVE FILE READER =================
function getAllJsFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            files = files.concat(getAllJsFiles(fullPath));
        } else if (item.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

// ================= CLOUD SYNC =================
async function syncSessionToCloud(creds) {
    try {
        const base64 = Buffer.from(JSON.stringify(creds)).toString("base64");
        await supabase.from("bunny_sessions").upsert({
            id: 'bunny_session_v1',
            data: base64,
            client_id: global.clientId
        });
    } catch (e) {
        console.error("Cloud session update rejected:", e.message);
    }
}

async function loadSessionFromCloud() {
    try {
        const { data } = await supabase
           .from("bunny_sessions")
           .select("data")
           .eq("id", 'bunny_session_v1')
           .single();

        if (data) {
            const decoded = Buffer.from(data.data, "base64").toString("utf-8");
            if (!fs.existsSync("./session")) fs.mkdirSync("./session");
            fs.writeFileSync("./session/creds.json", decoded);
            console.log(`☁️ Session Restored from cloud`);
        }
    } catch (e) {
        console.log("No cloud session found. Awaiting new session...");
    }
}

// ================= SETTINGS SYNC =================
async function syncSettings() {
    try {
        const { data: allSettings } = await supabase
           .from("bunny_settings")
           .select("setting_name, extra_data")
           .eq("client_id", global.clientId);

        if (allSettings) {
            for (const item of allSettings) {
                if (item.setting_name === "prefix") global.prefix = item.extra_data.current || ".";
                if (item.setting_name === "bot_name") global.botName = item.extra_data.current || "Bunny MD";
                if (item.setting_name === "owner_name") global.ownerName = item.extra_data.current || "Lupin Starnley";
            }
        }

        supabase
           .channel(`live-bunny-settings-${global.clientId}`)
           .on("postgres_changes", {
                event: "UPDATE",
                schema: "public",
                table: "bunny_settings",
                filter: `client_id=eq.${global.clientId}`
            }, payload => {
                const updatedSetting = payload.new.setting_name;
                const updatedValue = payload.new.extra_data?.current;

                if (updatedSetting === "prefix") global.prefix = updatedValue;
                if (updatedSetting === "bot_name") global.botName = updatedValue;
                if (updatedSetting === "owner_name") global.ownerName = updatedValue;

                console.log(`🔔 Config Updated: ${updatedSetting} -> ${updatedValue}`);
            })
           .subscribe();
    } catch (e) {
        console.error("Settings sync error:", e.message);
    }
}

// ================= MAIN ENGINE =================
async function startBunnyEngine(botId = global.clientId, isNewConnection = false, injectedCreds = null) {
    if (isConnecting) return;
    isConnecting = true;

    try {
        if (injectedCreds) {
            if (!fs.existsSync("./session")) fs.mkdirSync("./session");
            fs.writeFileSync("./session/creds.json", JSON.stringify(injectedCreds, null, 2));
            console.log(`📥 Credentials injected`);
        } else {
            await loadSessionFromCloud();
        }

        await syncSettings();
        loadCommands();
        loadObservers();
        startAutoReload();

        const { state, saveCreds } = await useMultiFileAuthState("session");
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
            },
            browser: ["Bunny MD Core", "Chrome", "20.0.0"],
            markOnlineOnConnect: false
        });

        // ================= MESSAGE ROUTING =================
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const m = messages[0];
            if (!m ||!m.message) return;

            let body =
                m.message?.conversation ||
                m.message?.extendedTextMessage?.text ||
                m.message?.imageMessage?.caption ||
                m.message?.videoMessage?.caption ||
                "";
            body = body.trim();

            m.chat = m.key.remoteJid;
            m.sender = m.key.participant || m.chat;
            m.reply = (t) => sock.sendMessage(m.chat, { text: t }, { quoted: m });

            // Run observers
            for (const obs of observers) {
                try {
                    if (!obs.trigger || obs.trigger(m)) {
                        await obs.onMessage(m, sock, {
                            supabase,
                            cache,
                            clientId: global.clientId,
                            userSettings: cache.getUser?.(m.sender) || {}
                        });
                    }
                } catch (e) {}
            }

            // Run router
            try {
                const route = await router(m, {
                    body,
                    commands,
                    aliases,
                    observers,
                    cache,
                    supabase,
                    prefix: global.prefix,
                    clientId: global.clientId
                });

                if (!route) return;

                if (route.type === "command" && route.command) {
                    await route.command.execute(m, sock, route.context);
                }
                else if (route.type === "custom" && typeof route.execute === "function") {
                    await route.execute(sock);
                }
            } catch (e) {
                console.error("Router Error:", e.message);
            }
        });

        // ================= CONNECTION HANDLER =================
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                const qrData = await QRCode.toDataURL(qr);
                io.emit("qr", qrData);
                io.emit("qrCodeResponse", { qr: qrData });
            }

            if (connection === "close") {
                isConnecting = false;
                onboardingSent = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
                console.log(`⚠️ Connection closed. Reconnect: ${shouldReconnect}`);
                if (shouldReconnect) setTimeout(() => startBunnyEngine(), 3000);
            }

            if (connection === "open" &&!onboardingSent) {
                onboardingSent = true;
                isConnecting = false;
                console.log(`✅ ${global.botName} Connected Successfully`);
                io.emit("connected");
                io.emit("pairingSuccess");
                await syncSessionToCloud(state.creds);

                try {
                    const cleanUserNumber = sock.user.id.split(":")[0];
                    const notificationMessage =
`╭─⌈ *${global.botName}* ⌋
│
│ Hello *${sock.user.name || 'BUNNY-MD USER'}*, system onboarding complete.
│ Instance is active and protected by cloud memory.
│
╰⊷ \`\`Powered by Bunny Tech\`\`

╭─⌈ *CONFIG* ⌋
│
╰⊷ Prefix: \`\`${global.prefix}\`\`
╰⊷ Bot: *${global.botName}*
╰⊷ Owner: *${global.ownerName}*
│
╰⊷ Type *${global.prefix}menu* for features`;

                    await sock.sendMessage(`${cleanUserNumber}@s.whatsapp.net`, {
                        image: { url: "https://i.ibb.co/Mdg2Fkd/file-00000f41871fdb744b8a6b7b612fa.png" },
                        caption: notificationMessage
                    });
                } catch (msgErr) {
                    console.error("Onboarding send error:", msgErr.message);
                }
            }
        });

        sock.ev.on("creds.update", async () => {
            await saveCreds();
            await syncSessionToCloud(state.creds);
        });

    } catch (err) {
        console.error("Engine start error:", err);
        isConnecting = false;
        setTimeout(() => startBunnyEngine(), 5000);
    }
}

// ================= SOCKET BINDING =================
if (fs.existsSync(path.join(__dirname, "socket", "socket.js"))) {
    try {
        const { bindSocketRoutingEngine } = require("./socket/socket.js");
        if (typeof bindSocketRoutingEngine === "function") {
            bindSocketRoutingEngine(io, startBunnyEngine, global.clientId, 1, supabase);
        }
    } catch (sockFileErr) {
        console.log("Socket system pending:", sockFileErr.message);
    }
}

server.listen(PORT, () => {
    console.log(`🚀 ${global.botName} running on port ${PORT}`);
    startBunnyEngine();
});

process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (reason) => console.error("Unhandled:", reason));
