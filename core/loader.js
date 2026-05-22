const fs = require("fs");
const path = require("path");

const commandsPath = path.join(__dirname, "..", "commands");
const observersPath = path.join(__dirname, "..", "observers");

let commands = new Map();
let observers = [];

// Debounce timers
let cmdReloadTimer = null;
let obsReloadTimer = null;

function loadCommands() {
  commands.clear();
  readDirRecursive(commandsPath, (filePath) => {
    if (!filePath.endsWith(".js")) return;
    try {
      delete require.cache[require.resolve(filePath)];
      const cmd = require(filePath);
      if (!cmd.config?.name || typeof cmd.execute!== "function") return;

      commands.set(cmd.config.name, cmd);
      console.log(`[Loader] Command loaded: ${cmd.config.name}`);
    } catch (err) {
      console.error(`[Loader] Failed to load ${filePath}:`, err.message);
    }
  });

  watchCommands();
  return commands;
}

function loadObservers() {
  observers = [];
  readDirRecursive(observersPath, (filePath) => {
    if (!filePath.endsWith(".js")) return;
    try {
      delete require.cache[require.resolve(filePath)];
      const obs = require(filePath);
      if (typeof obs === "function") {
        observers.push(obs);
        console.log(`[Loader] Observer loaded: ${path.basename(filePath)}`);
      }
    } catch (err) {
      console.error(`[Loader] Failed to load observer ${filePath}:`, err.message);
    }
  });

  watchObservers();
  return observers;
}

function readDirRecursive(dir, callback) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      readDirRecursive(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

function watchCommands() {
  if (!fs.existsSync(commandsPath)) return;

  fs.watch(commandsPath, { recursive: true }, () => {
    clearTimeout(cmdReloadTimer);
    cmdReloadTimer = setTimeout(() => {
      console.log("[Loader] Reloading commands...");
      loadCommands();
    }, 800);
  });
}

function watchObservers() {
  if (!fs.existsSync(observersPath)) return;

  fs.watch(observersPath, { recursive: true }, () => {
    clearTimeout(obsReloadTimer);
    obsReloadTimer = setTimeout(() => {
      console.log("[Loader] Reloading observers...");
      loadObservers();
    }, 800);
  });
}

module.exports = { loadCommands, loadObservers };