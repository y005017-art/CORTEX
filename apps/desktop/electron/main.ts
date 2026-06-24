import { app, BrowserWindow, ipcMain, shell, WebContentsView } from "electron";
import path from "node:path";

type PanePayload = {
  paneId: string;
  sessionId: string;
  title: string;
  workspaceUrl: string;
  bounds: { x: number; y: number; width: number; height: number };
};

type ViewStatus = {
  sessionId: string;
  title: string;
  workspaceUrl: string;
  currentUrl: string;
  pageTitle: string;
  state: "loading" | "ready" | "failed";
  error?: string;
};

const rendererUrl = process.env.CORTEX_DESKTOP_RENDERER_URL;
const runtimeLogPath = path.join(app.getPath("userData"), "cortex-desktop-runtime.log");

let mainWindow: BrowserWindow | null = null;
const viewRegistry = new Map<string, WebContentsView>();
const lastStatuses = new Map<string, ViewStatus>();

function appendRuntimeLog(message: string) {
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${message}\n`;
  try {
    require("node:fs").appendFileSync(runtimeLogPath, line, "utf8");
  } catch {
    console.log(line.trim());
  }
}

function emitViewStatus(status: ViewStatus) {
  lastStatuses.set(status.sessionId, status);
  appendRuntimeLog(
    `${status.sessionId} | ${status.state} | target=${status.workspaceUrl} | current=${status.currentUrl} | title=${status.pageTitle}${status.error ? ` | error=${status.error}` : ""}`
  );
  mainWindow?.webContents.send("workbench:view-status", status);
}

function ensureView(payload: PanePayload) {
  if (!mainWindow) {
    return null;
  }

  let view = viewRegistry.get(payload.sessionId);
  if (!view) {
    view = new WebContentsView({
      webPreferences: {
        partition: `persist:cortex-role-${payload.sessionId}`,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    view.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    view.webContents.on("did-start-loading", () => {
      emitViewStatus({
        sessionId: payload.sessionId,
        title: payload.title,
        workspaceUrl: payload.workspaceUrl,
        currentUrl: view!.webContents.getURL(),
        pageTitle: view!.webContents.getTitle(),
        state: "loading",
      });
    });

    view.webContents.on("page-title-updated", () => {
      emitViewStatus({
        sessionId: payload.sessionId,
        title: payload.title,
        workspaceUrl: payload.workspaceUrl,
        currentUrl: view!.webContents.getURL(),
        pageTitle: view!.webContents.getTitle(),
        state: "ready",
      });
    });

    view.webContents.on("did-finish-load", () => {
      emitViewStatus({
        sessionId: payload.sessionId,
        title: payload.title,
        workspaceUrl: payload.workspaceUrl,
        currentUrl: view!.webContents.getURL(),
        pageTitle: view!.webContents.getTitle(),
        state: "ready",
      });
    });

    view.webContents.on("did-fail-load", (_event, code, description, validatedURL) => {
      emitViewStatus({
        sessionId: payload.sessionId,
        title: payload.title,
        workspaceUrl: payload.workspaceUrl,
        currentUrl: validatedURL,
        pageTitle: view!.webContents.getTitle(),
        state: "failed",
        error: `${code}: ${description}`,
      });
    });

    mainWindow.contentView.addChildView(view);
    viewRegistry.set(payload.sessionId, view);
  }

  const targetUrl = payload.workspaceUrl.trim();
  if (targetUrl && view.webContents.getURL() !== targetUrl) {
    void view.webContents.loadURL(targetUrl);
  }

  view.setBounds(payload.bounds);
  view.setVisible(true);
  return view;
}

function hideInactiveViews(activeSessionIds: Set<string>) {
  for (const [sessionId, view] of viewRegistry.entries()) {
    if (!activeSessionIds.has(sessionId)) {
      view.setVisible(false);
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1680,
    height: 1020,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: "#0b1220",
    title: "CORTEX Desktop",
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist-electron", "electron", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  mainWindow.webContents.on("did-fail-load", (_event, code, description, validatedURL) => {
    appendRuntimeLog(`main-window | failed | url=${validatedURL} | error=${code}: ${description}`);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    appendRuntimeLog(`main-window | ready | url=${mainWindow?.webContents.getURL() ?? ""}`);
  });

  mainWindow.webContents.on("console-message", (_event, level, message) => {
    appendRuntimeLog(`renderer-console | level=${level} | ${message}`);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    appendRuntimeLog(`render-process-gone | reason=${details.reason} | exitCode=${details.exitCode}`);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("workbench:get-bootstrap", () => ({
  apiBaseUrl: process.env.CORTEX_API_BASE_URL ?? "http://127.0.0.1:8000",
  defaultProjectId: process.env.CORTEX_PROJECT_ID ?? "",
  defaultEmail: process.env.CORTEX_DESKTOP_EMAIL ?? "",
  defaultPassword: process.env.CORTEX_DESKTOP_PASSWORD ?? "",
  runtimeLogPath,
  presetToken: process.env.CORTEX_AUTH_TOKEN ?? "",
}));

ipcMain.handle("workbench:get-view-statuses", () => Array.from(lastStatuses.values()));

ipcMain.handle(
  "workbench:request",
  async (
    _event,
    payload: {
      baseUrl: string;
      path: string;
      token?: string;
      method?: string;
      body?: unknown;
    }
  ) => {
    appendRuntimeLog(`api-request | ${payload.method ?? "GET"} ${payload.baseUrl}${payload.path}`);
    const response = await fetch(`${payload.baseUrl}${payload.path}`, {
      method: payload.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(payload.token ? { Authorization: `Bearer ${payload.token}` } : {}),
      },
      body: payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
    });

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!response.ok) {
      appendRuntimeLog(`api-request | failed | ${response.status} ${payload.path}`);
      throw new Error(typeof parsed === "string" ? parsed : `Request failed: ${response.status}`);
    }

    appendRuntimeLog(`api-request | ok | ${response.status} ${payload.path}`);
    return parsed;
  }
);

ipcMain.on("workbench:sync-views", (_event, panes: PanePayload[]) => {
  const activeSessionIds = new Set<string>();
  for (const pane of panes) {
    if (!pane.workspaceUrl) {
      continue;
    }
    activeSessionIds.add(pane.sessionId);
    ensureView(pane);
  }
  hideInactiveViews(activeSessionIds);
});

ipcMain.on("workbench:refresh-view", (_event, sessionId: string) => {
  const view = viewRegistry.get(sessionId);
  if (view) {
    void view.webContents.reload();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

process.on("uncaughtException", (error) => {
  appendRuntimeLog(`uncaughtException | ${error.stack ?? error.message}`);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
