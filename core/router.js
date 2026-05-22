async function routeMessage(msg, sock, { commands, aliases, observers, state }) {
  try {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const body = getMessageBody(msg);
    if (!body) return;

    // Run observers first
    for (const obs of observers) {
      try {
        await obs({ msg, sock, state, from, sender, body });
      } catch (e) {
        console.error("[Observer Error]:", e.message);
      }
    }

    // Check prefix
    if (!body.startsWith(state.prefix)) return;

    const args = body.slice(state.prefix.length).trim().split(/\s+/);
    const cmdName = args.shift().toLowerCase();
    const commandName = aliases.get(cmdName) || cmdName;

    const command = commands.get(commandName);
    if (!command) return;

    const ctx = {
      sock,
      msg,
      args,
      state,
      from,
      sender,
      body,
      isOwner: state.isOwner(sender),
      reply: async (text) => {
        await sock.sendMessage(from, { text }, { quoted: msg });
      }
    };

    await command.execute(ctx);
  } catch (err) {
    console.error("[Router Error]:", err.message);
  }
}

function getMessageBody(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    ""
  );
}

module.exports = { routeMessage };