import "./Dashboard.css";
import Brain from "../brain/Brain";

export default function Dashboard() {
    return (
        <main className="dashboard">

            <header className="topbar">
                <h1>KIWI HQ</h1>
            </header>

            <section className="brain-section">
                <Brain />
            </section>

            <section className="widgets">

                <div className="widget">
                    Space News
                </div>

                <div className="widget">
                    AI News
                </div>

                <div className="widget">
                    Projects
                </div>

            </section>

            <footer className="command-bar">
                Command Bar
            </footer>

        </main>
    );
}