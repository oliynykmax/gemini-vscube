import { webview } from "electrobun/webview";
import type { MainviewRPCType, AppMode, AppState } from "../shared/types";

const rpc = webview.defineRPC<MainviewRPCType>({
  maxRequestTime: 10000,
  handlers: {
    requests: {},
    messages: {
      appStateChanged: (state: AppState) => {
        updateUI(state);
      },
    },
  },
});

let selectedMode: AppMode | null = null;
let currentState: AppState | null = null;

const globalModeBtn = document.getElementById("global-mode") as HTMLButtonElement;
const localModeBtn = document.getElementById("local-mode") as HTMLButtonElement;
const launchBtn = document.getElementById("launch-btn") as HTMLButtonElement;
const toggleServerBtn = document.getElementById("toggle-server") as HTMLButtonElement;
const serverControls = document.getElementById("server-controls") as HTMLDivElement;
const statusIndicator = document.getElementById("status-indicator") as HTMLSpanElement;
const serverStatusText = document.getElementById("server-status-text") as HTMLSpanElement;
const modeValue = document.getElementById("mode-value") as HTMLSpanElement;

function updateUI(state: AppState) {
  currentState = state;

  globalModeBtn.classList.toggle("active", state.mode === "global");
  localModeBtn.classList.toggle("active", state.mode === "local");

  selectedMode = state.mode;
  launchBtn.disabled = false;
  launchBtn.textContent = `Launch ${state.mode === "global" ? "Global" : "Local"} Mode`;
  modeValue.textContent = state.mode === "global" ? "Global (Online)" : "Local (Offline)";

  if (state.mode === "local") {
    serverControls.style.display = "block";
    statusIndicator.classList.toggle("running", state.localServerRunning);
    serverStatusText.textContent = state.localServerRunning
      ? `Server running at ${state.localServerUrl}`
      : "Server stopped";
    toggleServerBtn.textContent = state.localServerRunning ? "Stop Server" : "Start Server";
  } else {
    serverControls.style.display = "none";
  }
}

async function init() {
  try {
    const state = await rpc.handlers.requests.getAppState();
    updateUI(state);
  } catch (error) {
    console.error("Failed to get app state:", error);
  }
}

globalModeBtn.addEventListener("click", async () => {
  selectedMode = "global";
  globalModeBtn.classList.add("active");
  localModeBtn.classList.remove("active");
  launchBtn.disabled = false;
  launchBtn.textContent = "Launch Global Mode";
  serverControls.style.display = "none";
});

localModeBtn.addEventListener("click", async () => {
  selectedMode = "local";
  localModeBtn.classList.add("active");
  globalModeBtn.classList.remove("active");
  launchBtn.disabled = false;
  launchBtn.textContent = "Launch Local Mode";
  serverControls.style.display = "block";

  if (!currentState?.localServerRunning) {
    try {
      launchBtn.disabled = true;
      launchBtn.textContent = "Starting server...";
      const result = await rpc.handlers.requests.startLocalServer();
      if (result.ok) {
        statusIndicator.classList.add("running");
        serverStatusText.textContent = `Server running at ${result.url}`;
        toggleServerBtn.textContent = "Stop Server";
      } else {
        alert("Failed to start local server: " + result.error);
      }
    } catch (error) {
      console.error("Failed to start server:", error);
      alert("Failed to start local server");
    } finally {
      launchBtn.disabled = false;
      launchBtn.textContent = "Launch Local Mode";
    }
  }
});

launchBtn.addEventListener("click", async () => {
  if (!selectedMode) return;

  launchBtn.disabled = true;
  launchBtn.textContent = "Launching...";

  try {
    const result = await rpc.handlers.requests.setMode({ mode: selectedMode });
    if (!result.ok) {
      alert(result.error || "Failed to switch mode");
    }
  } catch (error) {
    console.error("Failed to set mode:", error);
    alert("Failed to launch mode");
  } finally {
    launchBtn.disabled = false;
    launchBtn.textContent = `Launch ${selectedMode === "global" ? "Global" : "Local"} Mode`;
  }
});

toggleServerBtn.addEventListener("click", async () => {
  if (!currentState) return;

  toggleServerBtn.disabled = true;

  try {
    if (currentState.localServerRunning) {
      await rpc.handlers.requests.stopLocalServer();
      statusIndicator.classList.remove("running");
      serverStatusText.textContent = "Server stopped";
      toggleServerBtn.textContent = "Start Server";
    } else {
      const result = await rpc.handlers.requests.startLocalServer();
      if (result.ok) {
        statusIndicator.classList.add("running");
        serverStatusText.textContent = `Server running at ${result.url}`;
        toggleServerBtn.textContent = "Stop Server";
      } else {
        alert("Failed to start server: " + result.error);
      }
    }
  } catch (error) {
    console.error("Server toggle error:", error);
  } finally {
    toggleServerBtn.disabled = false;
  }
});

init();
