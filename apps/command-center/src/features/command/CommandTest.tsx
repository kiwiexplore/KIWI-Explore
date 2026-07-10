import { useState } from "react";
import { executeCommand } from "./CommandEngine";

export default function CommandTest() {

    const [command, setCommand] = useState("");
    const [output, setOutput] = useState("");

    function runCommand() {
        setOutput(executeCommand(command));
    }

    return (

        <div>

            <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Type command..."
            />

            <button onClick={runCommand}>
                Execute
            </button>

            <p>{output}</p>

        </div>

    );

}