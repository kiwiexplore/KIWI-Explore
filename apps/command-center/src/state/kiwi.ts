export interface KiwiState {

    version: string;

    status: string;

    activeModule: string;

    lastCommand: string;

}

export const kiwiState: KiwiState = {

    version: "0.0.3",

    status: "Online",

    activeModule: "Dashboard",

    lastCommand: "",

};

export function setStatus(status: string) {
    kiwiState.status = status;
}

export function setActiveModule(module: string) {
    kiwiState.activeModule = module;
}

export function setLastCommand(command: string) {
    kiwiState.lastCommand = command;
}

export function getState() {
    return kiwiState;
}