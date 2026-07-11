import "./Panel.css";
import type { ReactNode } from "react";

interface PanelProps {
    title: string;
    children: ReactNode;
}

export default function Panel({ title, children }: PanelProps) {
    return (
        <section className="panel">

            <header className="panel-header">
                {title}
            </header>

            <div className="panel-body">
                {children}
            </div>

        </section>
    );
}