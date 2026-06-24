/// <reference types="vite/client" />

declare global {
  interface Window {
    cortexDesktop: {
      getBootstrap: () => Promise<import("./types").BootstrapConfig>;
      request: <T>(payload: import("./types").DesktopRequest) => Promise<T>;
      syncViews: (panes: import("./types").PaneDefinition[]) => void;
      refreshView: (sessionId: string) => void;
      getViewStatuses: () => Promise<import("./types").ViewStatus[]>;
      onViewStatus: (callback: (status: import("./types").ViewStatus) => void) => () => void;
    };
  }
}

export {};
