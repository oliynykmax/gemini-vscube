// node_modules/electrobun/dist/api/shared/rpc.ts
var MAX_ID = 10000000000;
var DEFAULT_MAX_REQUEST_TIME = 1000;
function missingTransportMethodError(methods, action) {
  const methodsString = methods.map((m) => `"${m}"`).join(", ");
  return new Error(`This RPC instance cannot ${action} because the transport did not provide one or more of these methods: ${methodsString}`);
}
function createRPC(options = {}) {
  let debugHooks = {};
  let transport = {};
  let requestHandler = undefined;
  function setTransport(newTransport) {
    if (transport.unregisterHandler)
      transport.unregisterHandler();
    transport = newTransport;
    transport.registerHandler?.(handler);
  }
  function setRequestHandler(h) {
    if (typeof h === "function") {
      requestHandler = h;
      return;
    }
    requestHandler = (method, params) => {
      const handlerFn = h[method];
      if (handlerFn)
        return handlerFn(params);
      const fallbackHandler = h._;
      if (!fallbackHandler)
        throw new Error(`The requested method has no handler: ${String(method)}`);
      return fallbackHandler(method, params);
    };
  }
  const { maxRequestTime = DEFAULT_MAX_REQUEST_TIME } = options;
  if (options.transport)
    setTransport(options.transport);
  if (options.requestHandler)
    setRequestHandler(options.requestHandler);
  if (options._debugHooks)
    debugHooks = options._debugHooks;
  let lastRequestId = 0;
  function getRequestId() {
    if (lastRequestId <= MAX_ID)
      return ++lastRequestId;
    return lastRequestId = 0;
  }
  const requestListeners = new Map;
  const requestTimeouts = new Map;
  function requestFn(method, ...args) {
    const params = args[0];
    return new Promise((resolve, reject) => {
      if (!transport.send)
        throw missingTransportMethodError(["send"], "make requests");
      const requestId = getRequestId();
      const request2 = {
        type: "request",
        id: requestId,
        method,
        params
      };
      requestListeners.set(requestId, { resolve, reject });
      if (maxRequestTime !== Infinity)
        requestTimeouts.set(requestId, setTimeout(() => {
          requestTimeouts.delete(requestId);
          reject(new Error("RPC request timed out."));
        }, maxRequestTime));
      debugHooks.onSend?.(request2);
      transport.send(request2);
    });
  }
  const request = new Proxy(requestFn, {
    get: (target, prop, receiver) => {
      if (prop in target)
        return Reflect.get(target, prop, receiver);
      return (params) => requestFn(prop, params);
    }
  });
  const requestProxy = request;
  function sendFn(message, ...args) {
    const payload = args[0];
    if (!transport.send)
      throw missingTransportMethodError(["send"], "send messages");
    const rpcMessage = {
      type: "message",
      id: message,
      payload
    };
    debugHooks.onSend?.(rpcMessage);
    transport.send(rpcMessage);
  }
  const send = new Proxy(sendFn, {
    get: (target, prop, receiver) => {
      if (prop in target)
        return Reflect.get(target, prop, receiver);
      return (payload) => sendFn(prop, payload);
    }
  });
  const sendProxy = send;
  const messageListeners = new Map;
  const wildcardMessageListeners = new Set;
  function addMessageListener(message, listener) {
    if (!transport.registerHandler)
      throw missingTransportMethodError(["registerHandler"], "register message listeners");
    if (message === "*") {
      wildcardMessageListeners.add(listener);
      return;
    }
    if (!messageListeners.has(message))
      messageListeners.set(message, new Set);
    messageListeners.get(message).add(listener);
  }
  function removeMessageListener(message, listener) {
    if (message === "*") {
      wildcardMessageListeners.delete(listener);
      return;
    }
    messageListeners.get(message)?.delete(listener);
    if (messageListeners.get(message)?.size === 0)
      messageListeners.delete(message);
  }
  async function handler(message) {
    debugHooks.onReceive?.(message);
    if (!("type" in message))
      throw new Error("Message does not contain a type.");
    if (message.type === "request") {
      if (!transport.send || !requestHandler)
        throw missingTransportMethodError(["send", "requestHandler"], "handle requests");
      const { id, method, params } = message;
      let response;
      try {
        response = {
          type: "response",
          id,
          success: true,
          payload: await requestHandler(method, params)
        };
      } catch (error) {
        if (!(error instanceof Error))
          throw error;
        response = {
          type: "response",
          id,
          success: false,
          error: error.message
        };
      }
      debugHooks.onSend?.(response);
      transport.send(response);
      return;
    }
    if (message.type === "response") {
      const timeout = requestTimeouts.get(message.id);
      if (timeout != null)
        clearTimeout(timeout);
      const { resolve, reject } = requestListeners.get(message.id) ?? {};
      if (!message.success)
        reject?.(new Error(message.error));
      else
        resolve?.(message.payload);
      return;
    }
    if (message.type === "message") {
      for (const listener of wildcardMessageListeners)
        listener(message.id, message.payload);
      const listeners = messageListeners.get(message.id);
      if (!listeners)
        return;
      for (const listener of listeners)
        listener(message.payload);
      return;
    }
    throw new Error(`Unexpected RPC message type: ${message.type}`);
  }
  const proxy = { send: sendProxy, request: requestProxy };
  return {
    setTransport,
    setRequestHandler,
    request,
    requestProxy,
    send,
    sendProxy,
    addMessageListener,
    removeMessageListener,
    proxy
  };
}
function defineElectrobunRPC(_side, config) {
  const rpcOptions = {
    maxRequestTime: config.maxRequestTime,
    requestHandler: {
      ...config.handlers.requests,
      ...config.extraRequestHandlers
    },
    transport: {
      registerHandler: () => {}
    }
  };
  const rpc = createRPC(rpcOptions);
  const messageHandlers = config.handlers.messages;
  if (messageHandlers) {
    rpc.addMessageListener("*", (messageName, payload) => {
      const globalHandler = messageHandlers["*"];
      if (globalHandler) {
        globalHandler(messageName, payload);
      }
      const messageHandler = messageHandlers[messageName];
      if (messageHandler) {
        messageHandler(payload);
      }
    });
  }
  return rpc;
}

// node_modules/electrobun/dist/api/browser/index.ts
var WEBVIEW_ID = window.__electrobunWebviewId;
var RPC_SOCKET_PORT = window.__electrobunRpcSocketPort;

class Electroview {
  bunSocket;
  rpc;
  rpcHandler;
  constructor(config) {
    this.rpc = config.rpc;
    this.init();
  }
  init() {
    this.initSocketToBun();
    window.__electrobun.receiveMessageFromBun = this.receiveMessageFromBun.bind(this);
    if (this.rpc) {
      this.rpc.setTransport(this.createTransport());
    }
  }
  initSocketToBun() {
    const socket = new WebSocket(`ws://localhost:${RPC_SOCKET_PORT}/socket?webviewId=${WEBVIEW_ID}`);
    this.bunSocket = socket;
    socket.addEventListener("open", () => {});
    socket.addEventListener("message", async (event) => {
      const message = event.data;
      if (typeof message === "string") {
        try {
          const encryptedPacket = JSON.parse(message);
          const decrypted = await window.__electrobun_decrypt(encryptedPacket.encryptedData, encryptedPacket.iv, encryptedPacket.tag);
          this.rpcHandler?.(JSON.parse(decrypted));
        } catch (err) {
          console.error("Error parsing bun message:", err);
        }
      } else if (message instanceof Blob) {} else {
        console.error("UNKNOWN DATA TYPE RECEIVED:", event.data);
      }
    });
    socket.addEventListener("error", (event) => {
      console.error("Socket error:", event);
    });
    socket.addEventListener("close", (_event) => {});
  }
  createTransport() {
    const that = this;
    return {
      send(message) {
        try {
          const messageString = JSON.stringify(message);
          that.bunBridge(messageString);
        } catch (error) {
          console.error("bun: failed to serialize message to webview", error);
        }
      },
      registerHandler(handler) {
        that.rpcHandler = handler;
      }
    };
  }
  async bunBridge(msg) {
    if (this.bunSocket?.readyState === WebSocket.OPEN) {
      try {
        const { encryptedData, iv, tag } = await window.__electrobun_encrypt(msg);
        const encryptedPacket = {
          encryptedData,
          iv,
          tag
        };
        const encryptedPacketString = JSON.stringify(encryptedPacket);
        this.bunSocket.send(encryptedPacketString);
        return;
      } catch (error) {
        console.error("Error sending message to bun via socket:", error);
      }
    }
    window.__electrobunBunBridge?.postMessage(msg);
  }
  receiveMessageFromBun(msg) {
    if (this.rpcHandler) {
      this.rpcHandler(msg);
    }
  }
  static defineRPC(config) {
    return defineElectrobunRPC("webview", {
      ...config,
      extraRequestHandlers: {
        evaluateJavascriptWithResponse: ({ script }) => {
          return new Promise((resolve) => {
            try {
              const resultFunction = new Function(script);
              const result = resultFunction();
              if (result instanceof Promise) {
                result.then((resolvedResult) => {
                  resolve(resolvedResult);
                }).catch((error) => {
                  console.error("bun: async script execution failed", error);
                  resolve(String(error));
                });
              } else {
                resolve(result);
              }
            } catch (error) {
              console.error("bun: failed to eval script", error);
              resolve(String(error));
            }
          });
        }
      }
    });
  }
}

// src/mainview/index.ts
var rpc = Electroview.defineRPC({
  maxRequestTime: 1e4,
  handlers: {
    requests: {},
    messages: {
      appStateChanged: (state) => {
        updateUI(state);
      }
    }
  }
});
var electroview = new Electroview({ rpc });
var selectedMode = null;
var currentState = null;
var globalModeBtn = document.getElementById("global-mode");
var localModeBtn = document.getElementById("local-mode");
var launchBtn = document.getElementById("launch-btn");
var toggleServerBtn = document.getElementById("toggle-server");
var serverControls = document.getElementById("server-controls");
var statusIndicator = document.getElementById("status-indicator");
var serverStatusText = document.getElementById("server-status-text");
var modeValue = document.getElementById("mode-value");
function updateUI(state) {
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
    serverStatusText.textContent = state.localServerRunning ? `Server running at ${state.localServerUrl}` : "Server stopped";
    toggleServerBtn.textContent = state.localServerRunning ? "Stop Server" : "Start Server";
  } else {
    serverControls.style.display = "none";
  }
}
async function init() {
  try {
    const state = await electroview.rpc.request.getAppState();
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
      const result = await electroview.rpc.request.startLocalServer();
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
  if (!selectedMode)
    return;
  launchBtn.disabled = true;
  launchBtn.textContent = "Launching...";
  try {
    const result = await electroview.rpc.request.setMode({ mode: selectedMode });
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
  if (!currentState)
    return;
  toggleServerBtn.disabled = true;
  try {
    if (currentState.localServerRunning) {
      await electroview.rpc.request.stopLocalServer();
      statusIndicator.classList.remove("running");
      serverStatusText.textContent = "Server stopped";
      toggleServerBtn.textContent = "Start Server";
    } else {
      const result = await electroview.rpc.request.startLocalServer();
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
