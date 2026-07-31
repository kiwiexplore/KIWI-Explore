import NeuralCore from "./NeuralCore";
import "./Brain.css";

export default function Brain() {
    return (
        <div className="brain-container">

            <div className="brain-core">

                <NeuralCore />

                <div className="core-label">
                    KIWI
                </div>

            </div>

            <h2>AI Operating System</h2>

            <p>ONLINE</p>

        </div>
    );
}