import StatusBar from "./StatusBar";
import TopBar from "./TopBar";
import Widget from "../widget/Widget";
import BrainSystem from "../brain/BrainSystem";
import { defaultWidgets } from "../../state/widgets";
import "./Dashboard.css";

export default function Dashboard() {

    const leftWidgets = defaultWidgets.filter((w) => w.column !== "right");
    const rightWidgets = defaultWidgets.filter((w) => w.column === "right");

    return (
        <main className="dashboard">

            <TopBar />

            <section className="hq-grid">

                <aside className="hq-panel hq-panel--left">
                    {leftWidgets.map((widget) => (
                        <Widget key={widget.id} definition={widget} />
                    ))}
                </aside>

                <section className="hq-center">
                    <BrainSystem />
                </section>

                <aside className="hq-panel hq-panel--right">
                    {rightWidgets.map((widget) => (
                        <Widget key={widget.id} definition={widget} />
                    ))}
                </aside>

            </section>

            <StatusBar />

        </main>
    );
}