import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("cortexDesktop", {
  getBootstrap: () => ipcRenderer.invoke("workbench:get-bootstrap"),
  request: (payload: unknown) => ipcRenderer.invoke("workbench:request", payload),
  syncViews: (panes: unknown) => ipcRenderer.send("workbench:sync-views", panes),
  refreshView: (sessionId: string) => ipcRenderer.send("workbench:refresh-view", sessionId),
  getViewStatuses: () => ipcRenderer.invoke("workbench:get-view-statuses"),
  onViewStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => callback(status);
    ipcRenderer.on("workbench:view-status", listener);
    return () => ipcRenderer.removeListener("workbench:view-status", listener);
  },
});
