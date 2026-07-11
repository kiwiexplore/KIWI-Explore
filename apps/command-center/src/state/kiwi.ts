import { create } from "zustand";

export interface KiwiState {
    version: string;
    status: string;
    activeModule: string;
    lastCommand: string;
    setStatus: (status: string) => void;
    setActiveModule: (module: string) => void;
    setLastCommand: (command: string) => void;
}

/**
 * Reactive KIWI state store.
 *
 * Use `useKiwiStore` inside React components — it triggers re-renders
 * automatically when the selected slice of state changes.
 *
 * Use `kiwiStore` (below) from plain, non-component code such as
 * CommandEngine.ts, where React hooks are not available.
 */
export const useKiwiStore = create<KiwiState>((set) => ({
    version: "0.0.3",
    status: "Online",
    activeModule: "Dashboard",
    lastCommand: "",

    setStatus: (status) => set({ status }),
    setActiveModule: (activeModule) => set({ activeModule }),
    setLastCommand: (lastCommand) => set({ lastCommand }),
}));

/**
 * Non-reactive accessor for use outside React components
 * (services, command engine, utils...).
 */
export const kiwiStore = {
    getState: useKiwiStore.getState,
    setStatus: (status: string) => useKiwiStore.getState().setStatus(status),
    setActiveModule: (module: string) => useKiwiStore.getState().setActiveModule(module),
    setLastCommand: (command: string) => useKiwiStore.getState().setLastCommand(command),
};
