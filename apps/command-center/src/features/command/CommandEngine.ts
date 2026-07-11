import { commands } from "./commands";
import { setLastCommand, setStatus } from "../../state/kiwi";

export function executeCommand(input: string): string {

    const command = input.trim().toLowerCase();
    setLastCommand(command);

    if (!commands.includes(command)) {
        return "Unknown command.";
    }

    switch (command) {

        case "help":
            setStatus("Helping");
            return "Available commands: help, version, about, clear";

        case "version":
            setStatus("System");
            return "KIWI OS v0.0.3";

        case "about":
            setStatus("Information");
            return "KIWI Explore - AI Operating System";

        case "clear":
            setStatus("Ready");
            return "Screen cleared.";

        default:
            setStatus("Error");
            return "Unknown command.";

    }
} //