import type { RPCSchema } from "electrobun/bun";

export type AppMode = "local" | "global";

export type AppState = {
  mode: AppMode;
  localServerPort: number;
  localServerRunning: boolean;
  localServerUrl?: string;
};

export type MainviewRPCType = {
  bun: RPCSchema<{
    requests: {
      getAppState: {
        params: Record<string, never>;
        response: AppState;
      };
      setMode: {
        params: { mode: AppMode };
        response: { ok: boolean; error?: string };
      };
      startLocalServer: {
        params: Record<string, never>;
        response: { ok: boolean; error?: string; url?: string };
      };
      stopLocalServer: {
        params: Record<string, never>;
        response: { ok: boolean };
      };
    };
    messages: {
      log: { msg: string };
    };
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      appStateChanged: AppState;
    };
  }>;
};
