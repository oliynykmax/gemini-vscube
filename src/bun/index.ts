import {
  BrowserWindow,
  BrowserView,
  ApplicationMenu,
  Utils,
  Tray,
  GlobalShortcut,
} from "electrobun/bun";
import Electrobun from "electrobun/bun";
import { join } from "path";
import { mkdirSync } from "fs";
import type { MainviewRPCType, AppMode, AppState } from "../shared/types";

const SETTINGS_DIR = Utils.paths.userData;
const SETTINGS_PATH = join(SETTINGS_DIR, "settings.json");

interface Settings {
  mode: AppMode;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

async function loadSettings(): Promise<Settings> {
  try {
    mkdirSync(SETTINGS_DIR, { recursive: true });
    const file = Bun.file(SETTINGS_PATH);
    if (await file.exists()) {
      const data = await file.json();
      if (data.mode === "local" || data.mode === "global") {
        return data as Settings;
      }
    }
  } catch {
    // ignore - fall through to default
  }
  return { mode: "global" };
}

async function saveSettings(settings: Settings) {
  mkdirSync(SETTINGS_DIR, { recursive: true });
  await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

const LOCAL_PORT = 3000;
let localServerProcess: ReturnType<typeof Bun.spawn> | null = null;
let localServerRunning = false;

async function startLocalServer(): Promise<boolean> {
  if (localServerRunning) return true;

  try {
    const res = await fetch(`http://localhost:${LOCAL_PORT}/health`).catch(() => null);
    if (res && res.ok) {
      localServerRunning = true;
      return true;
    }
  } catch {
    // Server not running, start it
  }

  try {
    const localServerPath = join(import.meta.dir, "..", "local-server", "index.ts");
    localServerProcess = Bun.spawn(["bun", "run", localServerPath], {
      env: { ...process.env, LOCAL_PORT: String(LOCAL_PORT) },
      stdout: "inherit",
      stderr: "inherit",
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const res = await fetch(`http://localhost:${LOCAL_PORT}/health`).catch(() => null);
    if (res && res.ok) {
      localServerRunning = true;
      console.log("[main] Local server started successfully");
      return true;
    }
  } catch (error) {
    console.error("[main] Failed to start local server:", error);
  }

  return false;
}

function stopLocalServer() {
  if (localServerProcess) {
    localServerProcess.kill();
    localServerProcess = null;
  }
  localServerRunning = false;
}

let currentSettings = await loadSettings();

function getAppState(): AppState {
  return {
    mode: currentSettings.mode,
    localServerPort: LOCAL_PORT,
    localServerRunning,
    localServerUrl: localServerRunning ? `http://localhost:${LOCAL_PORT}` : undefined,
  };
}

let launcherWin: BrowserWindow | null = null;
let contentWin: BrowserWindow | null = null;

async function openContentWindow(mode: AppMode) {
  if (contentWin) {
    contentWin.close();
    contentWin = null;
  }

  const url = mode === "global" ? "https://vscubing.com" : `http://localhost:${LOCAL_PORT}`;
  const title = mode === "global" ? "VSCubing – Global" : "VSCubing – Local";

  const bounds = currentSettings.windowBounds || { width: 1400, height: 900, x: 100, y: 100 };

  contentWin = new BrowserWindow({
    title,
    url,
    partition: "persist:vscubing-session",
    frame: bounds,
    sandbox: mode === "global",
  });

  contentWin.on("close", () => {
    contentWin = null;
  });

  contentWin.on("resize", (e) => {
    const { width, height } = e.data;
    if (contentWin) {
      currentSettings.windowBounds = {
        ...currentSettings.windowBounds,
        width,
        height,
      };
    }
  });

  contentWin.on("move", (e) => {
    const { x, y } = e.data;
    if (contentWin) {
      currentSettings.windowBounds = {
        ...currentSettings.windowBounds,
        x,
        y,
      };
    }
  });
}

const mainviewRPC = BrowserView.defineRPC<MainviewRPCType>({
  maxRequestTime: 10000,
  handlers: {
    requests: {
      getAppState: async () => getAppState(),
      setMode: async ({ mode }) => {
        if (mode !== "local" && mode !== "global") {
          return { ok: false, error: `Unknown mode: ${mode}` };
        }

        if (mode === "local") {
          const ok = await startLocalServer();
          if (!ok) {
            return {
              ok: false,
              error: "Failed to start local server. Check the logs for details.",
            };
          }
          localServerRunning = true;
        } else {
          stopLocalServer();
          localServerRunning = false;
        }

        currentSettings = { mode };
        await saveSettings(currentSettings);

        launcherWin?.webview.rpc.send.appStateChanged(getAppState());

        await openContentWindow(mode);
        return { ok: true };
      },
      startLocalServer: async () => {
        const ok = await startLocalServer();
        launcherWin?.webview.rpc.send.appStateChanged(getAppState());
        return {
          ok,
          error: ok ? undefined : "Failed to start local server",
          url: ok ? `http://localhost:${LOCAL_PORT}` : undefined,
        };
      },
      stopLocalServer: async () => {
        stopLocalServer();
        launcherWin?.webview.rpc.send.appStateChanged(getAppState());
        return { ok: true };
      },
    },
    messages: {
      log: ({ msg }) => {
        console.log("[renderer]", msg);
      },
    },
  },
});

launcherWin = new BrowserWindow({
  title: "VSCubing Desktop",
  url: "views://mainview/index.html",
  frame: { width: 500, height: 400, x: 400, y: 300 },
  rpc: mainviewRPC,
  resizable: false,
});

ApplicationMenu.setApplicationMenu([
  {
    submenu: [
      { role: "hide" },
      { role: "hideOthers" },
      { role: "showAll" },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Mode",
    submenu: [
      {
        label: "Global (Online)",
        action: "mode-global",
        accelerator: "CmdOrCtrl+G",
        tooltip: "Connect to vscubing.com",
      },
      {
        label: "Local (Offline)",
        action: "mode-local",
        accelerator: "CmdOrCtrl+L",
        tooltip: "Use local offline server",
      },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { type: "separator" },
      { role: "toggleFullScreen" },
      { type: "separator" },
      { role: "toggleDevTools" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      { type: "separator" },
      { role: "cycleThroughWindows" },
    ],
  },
]);

Electrobun.events.on("application-menu-clicked", async (e) => {
  const { action } = e.data;
  if (action === "mode-global") {
    await mainviewRPC.handlers.requests.setMode({ mode: "global" });
  } else if (action === "mode-local") {
    await mainviewRPC.handlers.requests.setMode({ mode: "local" });
  }
});

GlobalShortcut.register("CmdOrCtrl+Shift+L", async () => {
  if (currentSettings.mode === "local") {
    await mainviewRPC.handlers.requests.setMode({ mode: "global" });
  } else {
    await mainviewRPC.handlers.requests.setMode({ mode: "local" });
  }
});

process.on("exit", () => {
  stopLocalServer();
  saveSettings(currentSettings);
});

process.on("SIGINT", () => {
  stopLocalServer();
  saveSettings(currentSettings);
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopLocalServer();
  saveSettings(currentSettings);
  process.exit(0);
});

if (currentSettings.mode === "local") {
  startLocalServer().then((ok) => {
    if (ok) {
      openContentWindow("local");
    }
  });
}
