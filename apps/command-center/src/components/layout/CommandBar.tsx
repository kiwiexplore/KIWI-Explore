import { useState } from "react";
import { executeCommand } from "../../features/command/CommandEngine";
import "./CommandBar.css";

export default function CommandBar() {

    const [command, setCommand] = useState("");
    const [output, setOutput] = useState("");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const response = executeCommand(command);

        setOutput(response);
        setCommand("");
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="command-bar">

                <input
                    type="text"
                    placeholder="Ask KIWI..."
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                />

                <button type="submit">
                    Send
                </button>

            </form>

            {output && (
                <div className="command-output">
                    {output}
                </div>
            )}
        </>
    );
}