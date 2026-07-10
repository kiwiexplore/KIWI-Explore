import { commands } from "./commands";

export function executeCommand(input: string): string {

    const command = input.trim().toLowerCase();

    if (!commands.includes(command)) {
        return "Unknown command.";
    }

    switch (command) {

        case "help":
            return "Available commands: help, version, about, clear";

        case "version":
            return "KIWI OS v0.0.2";

        case "about":
            return "KIWI Explore - AI Operating System";

        case "clear":
            return "Screen cleared.";

        default:
            return "Unknown command.";

    }

}