import Panel from "../ui/Panel";
import StatusBar from "./StatusBar";
import CommandTest from "../../features/command/CommandTest";
import CommandBar from "./CommandBar";
import "./Dashboard.css";
import Brain from "../brain/Brain";

export default function Dashboard() {
    return (
        <main className="dashboard">

            <header className="topbar">
                <h1>KIWI HQ</h1>

                <StatusBar />
            </header>

            <section className="brain-section">
                <Brain />

            </section>

            <section className="widgets">

                <CommandTest />

                <Panel title="🚀 Space News">
                    No data available.
                </Panel>

                <Panel title="🤖 AI News">
                    No data available.
                </Panel>

                <Panel title="📁 Projects">
                    No active projects.
                </Panel>

            </section>

            <footer className="command-bar">
                <CommandBar />
            </footer>

            <StatusBar />

        </main>
    );
}