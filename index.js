require("dotenv").config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    getContentType
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

// ================= AUTO RELOAD ENGINE (LAZY LOADING) =================
let reloadLock = false;

function startAutoReload() {
    if (reloadLock) return;
    reloadLock = true;

    try {
        fs.watch(pluginPath, { persistent: true }, (event, file) => {
            if (file && file.endsWith(".js")) {
                console.log(`♻️ Command Layer changed: ${file}`);
                loadCommands();
            }
        });

        fs.watch(observerPath, { persistent: true }, (event, file) => {
            if (file && file.endsWith(".js")) {
                console.log(`👁️ Observer Layer changed: ${file}`);
                loadObservers();
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

// Serve public directory dynamically
app.use(express.static(path.join(__dirname, "public")));

// Redirect root to /pair layout natively
app.get("/", (req, res) => {
    res.redirect("/pair");
});

app.get("/pair", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pair.html"));
});

// ================= LOAD COMMANDS ARCHITECTURE =================
function loadCommands() {
    commands.clear();
    aliases.clear();

    if (!fs.existsSync(pluginPath)) fs.mkdirSync(pluginPath);

    const files = fs.readdirSync(pluginPath).filter(f => f.endsWith(".js"));

    for (const file of files) {
        try {
            const filePath = path.join(pluginPath, file);
            delete require.cache[require.resolve(filePath)];

            const plugin = require(filePath);
            const name = plugin.command || file.replace(".js", "");

            commands.set(name, plugin);

            if (Array.isArray(plugin.alias)) {
                for (const a of plugin.alias) {
                    aliases.set(a, name);
                }
            }
        } catch (e) {
            console.error(`Error mapping dynamic core file ${file}:`, e.message);
        }
    }
    console.log(`✅ ${commands.size} Custom Packages Parsed Successfully into Runtime memory.`);
}

// ================= LOAD OBSERVERS ARCHITECTURE =================
function loadObservers() {
    observers.length = 0;

    if (!fs.existsSync(observerPath)) fs.mkdirSync(observerPath);

    const files = fs.readdirSync(observerPath).filter(f => f.endsWith(".js"));

    for (const file of files) {
        try {
            const filePath = path.join(observerPath, file);
            delete require.cache[require.resolve(filePath)];

            const obs = require(filePath);
            if (obs.onMessage) observers.push(obs);

        } catch (e) {
            console.error(`Error mapping observer ${file}:`, e.message);
        }
    }
    console.log(`👁️ Observers Active: ${observers.length}`);
}

// ================= CLOUD SYNC ENGINE (BUNNY_SESSIONS) =================
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
            console.log(`☁️ Session Restored from bunny_sessions for ${global.clientId}`);
        }
    } catch (e) {
        console.log("No cloud session found. Awaiting fresh registration handshake...");
    }
}

// ================= NO-HARDCODED REALTIME SETTINGS SYNC =================
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
                
                console.log(`🔔 Cloud Config Updated: ${updatedSetting} -> ${updatedValue}`);
            })
            .subscribe();
    } catch (e) {
        console.error("Settings sync connection warning:", e.message);
    }
}

// ================= MAIN RUNTIME CORE =================
async function startBunnyEngine(botId = global.clientId, isNewConnection = false, injectedCreds = null) {
    
    if (injectedCreds) {
        if (!fs.existsSync("./session")) fs.mkdirSync("./session");
        fs.writeFileSync("./session/creds.json", JSON.stringify(injectedCreds, null, 2));
        console.log(`📥 Injected Fresh Registration Credentials directly into local storage lifecycle.`);
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
        browser: ["Bunny MD Core", "Chrome", "20.0.0"]
    });

    // ================= MESSAGE ROUTING AND OBSERVATION =================
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m || !m.message) return;

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

        try {
            // FIXED: Treating router as a direct function call
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
            console.error("Router Interface Runtime Error:", e.message);
        }
    });

    // ================= CONNECTION MONITORING =================
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            const qrData = await QRCode.toDataURL(qr);
            io.emit("qr", qrData);
            io.emit("qrCodeResponse", { qr: qrData }); 
        }

        if (connection === "close") {
            const shouldReconnect =
                (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log(`⚠️ Connection lost. Reconnecting status: ${shouldReconnect}`);
            if (shouldReconnect) startBunnyEngine();
        }

        if (connection === "open") {
            console.log(`✅ ${global.botName} Connected Successfully to WhatsApp Framework.`);
            io.emit("connected");
            io.emit("pairingSuccess"); 
            await syncSessionToCloud(state.creds);

            try {
                const cleanUserNumber = sock.user.id.split(":")[0];
                const notificationMessage = 
`╭─⌈ *${global.botName}* ⌋
│
│ Hello *${sock.user.name || 'BUNNY-MD USER'}*, system onboarding has completed successfully.
│ Your automation instance is now active and fully protected by cloud memory.
│
╰⊷ \`\`\`Powered by Bunny Tech\`\`\`

╭─⌈ *CONFIGURATION OVERVIEW* ⌋
│
╰⊷ Prefix Strategy: \`\`\`${global.prefix}\`\`\`
╰⊷ System Persona: *${global.botName}*
╰⊷ Core Architect: *${global.ownerName}*
│
╰⊷ _Type *${global.prefix}menu* inside any conversation to view features._`;

                await sock.sendMessage(`${cleanUserNumber}@s.whatsapp.net`, { 
                    image: { url: "https://i.ibb.co/Mdg2Fkd/file-00000000f41871fdb744b8a6b7b612fa.png" },
                    caption: notificationMessage 
                });
            } catch (msgErr) {
                console.error("Failed to route onboarding visual template via chat:", msgErr.message);
            }
        }
    });

    sock.ev.on("creds.update", async () => {
        await saveCreds();
        await syncSessionToCloud(state.creds);
    });
}

if (fs.existsSync(path.join(__dirname, "socket", "socket.js"))) {
    try {
        const { bindSocketRoutingEngine } = require("./socket/socket.js");
        if (typeof bindSocketRoutingEngine === "function") {
            bindSocketRoutingEngine(io, startBunnyEngine, global.clientId, 1, supabase);
        }
    } catch (sockFileErr) {
        console.log("Socket system integration pending setup configuration:", sockFileErr.message);
    }
}

server.listen(PORT, () => {
    console.log(`🚀 ${global.botName} running seamlessly on allocation port [:${PORT}]`);
    startBunnyEngine();
});

process.on("uncaughtException", (err) => console.error("Caught exception layer mitigation: ", err));
process.on("unhandledRejection", (reason, promise) => console.error("Unhandled Rejection handled:", reason));
                 
