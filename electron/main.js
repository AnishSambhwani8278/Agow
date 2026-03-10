import { app, ipcMain, safeStorage, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { exec, spawn } from "node:child_process";
import util from "node:util";

const execPromise = util.promisify(exec);
createRequire(import.meta.url);

const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(app.getPath("userData"), "aww-settings.json");

function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading config", e);
  }
  return {};
}

function writeConfig(data) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error writing config", e);
  }
}

process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "logo.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

ipcMain.handle("store:get", (event, key) => {
  const config = readConfig();
  return config[key];
});

ipcMain.handle("store:set", (event, key, value) => {
  const config = readConfig();
  config[key] = value;
  writeConfig(config);
  return true;
});

ipcMain.handle("config:get", () => {
  const isDev = !!VITE_DEV_SERVER_URL;
  // In dev it's in APP_ROOT, in prod it's inside app.asar (which is __dirname/..)
  const basePath = isDev ? process.env.APP_ROOT : path.join(__dirname$1, "..");
  const configPath = path.join(basePath, "config.json");
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading base config.json", e);
  }
  return {};
});

ipcMain.handle("keychain:get", () => {
  try {
    const config = readConfig();
    if (config.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(config.encryptedApiKey, "base64");
      return safeStorage.decryptString(buffer);
    }
  } catch (e) {
    console.error("Failed to decrypt API key", e);
  }
  return "";
});

ipcMain.handle("keychain:set", (event, key) => {
  try {
    if (safeStorage.isEncryptionAvailable() && key) {
      const encrypted = safeStorage.encryptString(key).toString("base64");
      const config = readConfig();
      config.encryptedApiKey = encrypted;
      writeConfig(config);
    }
  } catch (e) {
    console.error("Failed to encrypt API key", e);
  }
  return true;
});

ipcMain.handle("ai:generate", async (event, prompt, model, temperature) => {
  var _a;
  try {
    const config = readConfig();
    let apiKey = "";
    if (config.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
      apiKey = safeStorage.decryptString(Buffer.from(config.encryptedApiKey, "base64"));
    }
    if (!apiKey) throw new Error("API Key missing. Please set it in Settings.");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(((_a = data.error) == null ? void 0 : _a.message) || "Gemini API Error");
    return { success: true, text: data.candidates[0].content.parts[0].text };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("notes:sync", async (event, structuredNote) => {
  try {
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const dataDir = path.join(app.getPath("userData"), "notes");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const safeContent = JSON.stringify({ note: structuredNote }, null, 2);
    fs.writeFileSync(path.join(dataDir, `${dateStr}.json`), safeContent);
    const escapedText = structuredNote.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const title = `Daily Update - ${dateStr}`;
    const script = `
      tell application "Notes"
        set acc to account "On My Mac"
        if not (exists folder "Daily update" in acc) then
          return "ERROR: Please create a folder named 'Daily update' in Apple Notes under 'On My Mac'."
        end if
        
        set targetFolder to folder "Daily update" in acc
        set fullHTML to "<h1>" & "${title}" & "</h1><pre>" & "${escapedText}" & "</pre>"
        
        -- Check if a note with today's date exists
        set existingNotes to notes in targetFolder whose name starts with "Daily Update - ${dateStr}"
        if (count of existingNotes) > 0 then
          set targetNote to item 1 of existingNotes
          set body of targetNote to fullHTML
        else
          make new note at targetFolder with properties {body:fullHTML}
        end if
        return "SUCCESS"
      end tell
    `;
    const { stdout, stderr } = await execPromise(`osascript -e '${script.replace(/'/g, `'\\''`)}'`);
    if (stdout.includes("ERROR:")) {
      return { success: false, error: stdout.trim() };
    }
    if (stderr) {
      console.warn("AppleScript stderr:", stderr);
    }
    return { success: true };
  } catch (e) {
    console.error("Notes sync error:", e);
    return { success: false, error: "Failed to sync to Apple Notes. Please ensure Notes app is open and permissions are granted." };
  }
});

let whisperProcess = null;

ipcMain.handle("whisper:checkModel", () => {
  const modelPath = path.join(app.getPath("userData"), "whisper-models", "ggml-small.bin");
  return fs.existsSync(modelPath);
});

ipcMain.handle("whisper:deleteModel", async () => {
  const modelPath = path.join(app.getPath("userData"), "whisper-models", "ggml-small.bin");
  try {
    if (fs.existsSync(modelPath)) {
      fs.unlinkSync(modelPath);
    }
    return { success: true };
  } catch (e) {
    console.error("Delete Error:", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("whisper:downloadModel", async (event) => {
  const modelDir = path.join(app.getPath("userData"), "whisper-models");
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }
  const modelPath = path.join(modelDir, "ggml-small.bin");

  if (fs.existsSync(modelPath)) return { success: true };

  const url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Unexpected response ${res.statusText}`);

    // Fallback to known ggml-small.bin size if content-length is missing
    const totalBytes = Number(res.headers.get('content-length')) || 487601967;
    let receivedBytes = 0;

    const fileStream = fs.createWriteStream(modelPath);

    for await (const chunk of res.body) {
      receivedBytes += chunk.length;
      fileStream.write(chunk);
      if (totalBytes > 0 && win) {
        let progress = Math.round((receivedBytes / totalBytes) * 100);
        if (progress > 100) progress = 100;
        win.webContents.send("whisper:downloadProgress", progress);
      }
    }

    fileStream.end();
    if (win) win.webContents.send("whisper:downloadProgress", 100);
    return { success: true };
  } catch (e) {
    if (fs.existsSync(modelPath)) fs.unlinkSync(modelPath);
    console.error("Download Error:", e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("whisper:transcribeFile", async (event, arrayBuffer) => {
  try {
    const tempWavPath = path.join(app.getPath("temp"), "recording.wav");

    // Convert ArrayBuffer to Buffer and save
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempWavPath, buffer);

    const isDev = !!VITE_DEV_SERVER_URL;
    const cliBin = isDev
      ? path.join(process.env.APP_ROOT, "whisper.cpp", "build", "bin", "whisper-cli")
      : path.join(process.resourcesPath, "whisper-cli");

    const modelPath = path.join(app.getPath("userData"), "whisper-models", "ggml-small.bin");

    if (!fs.existsSync(cliBin)) {
      return { success: false, error: `Whisper CLI not found at ${cliBin}` };
    }
    if (!fs.existsSync(modelPath)) {
      return { success: false, error: "Whisper Model not found." };
    }

    return new Promise((resolve) => {
      // Run whisper-cli: -nt removes timestamps, -m is model, -f is file
      const process = spawn(cliBin, ["-m", modelPath, "-f", tempWavPath, "-nt"]);

      let fullText = "";
      let errorText = "";

      process.stdout.on("data", (data) => {
        fullText += data.toString();
      });

      process.stderr.on("data", (data) => {
        errorText += data.toString();
      });

      process.on("close", (code) => {
        if (code !== 0) {
          console.error("Whisper CLI exited with code", code, errorText);
          resolve({ success: false, error: `Whisper exited with ${code}` });
          return;
        }

        // Clean up the text: remove ANSI, empty lines, and brackets
        const cleanText = fullText
          .replace(/\[.*\]/g, "")
          .replace(/\(.*?\)/g, "")
          .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
          .replace(/\[_UNRECOGNIZED_\]/g, "")
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join(" ")
          .trim();

        if (fs.existsSync(tempWavPath)) {
          fs.unlinkSync(tempWavPath);
        }

        resolve({ success: true, text: cleanText });
      });
    });

  } catch (err) {
    console.error("Error in whisper:transcribeFile:", err);
    return { success: false, error: err.message || String(err) };
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
