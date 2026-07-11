import StatusBar from "./StatusBar";
import CommandTest from "../../features/command/CommandTest";
import CommandBar from "./CommandBar";
import Widget from "../widget/Widget";
import Brain from "../brain/Brain";
import { defaultWidgets } from "../../state/widgets";
import "./Dashboard.css";

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

                {defaultWidgets.map((widget) => (
                    <Widget key={widget.id} definition={widget} />
                ))}

            </section>

            <footer className="command-bar">
                <CommandBar />
            </footer>

            <StatusBar />

        </main>
    );
}
