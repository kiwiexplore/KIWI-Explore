import { commands } from "./commands";
import { kiwiStore } from "../../state/kiwi";

export function executeCommand(input: string): string {

    const command = input.trim().toLowerCase();
    kiwiStore.setLastCommand(command);

    if (!commands.includes(command)) {
        kiwiStore.setStatus("Error");
        return "Unknown command.";
    }

    switch (command) {

        case "help":
            kiwiStore.setStatus("Helping");
            return "Available commands: help, version, about, clear";

        case "version":
            kiwiStore.setStatus("System");
            return "KIWI OS v0.0.3";

        case "about":
            kiwiStore.setStatus("Information");
            return "KIWI Explore - AI Operating System";

        case "clear":
            kiwiStore.setStatus("Ready");
            return "Screen cleared.";

        default:
            kiwiStore.setStatus("Error");
            return "Unknown command.";

    }
}
