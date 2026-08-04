import "./Panel.css";
import type { MouseEvent, ReactNode } from "react";

interface PanelProps {
    title: string;
    children: ReactNode;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
}

export default function Panel({ title, children, onClick }: PanelProps) {
    return (
        <section
            className={`panel${onClick ? " panel-clickable" : ""}`}
            onClick={onClick}
        >

            <header className="panel-header">
                {title}
            </header>

            <div className="panel-body">
                {children}
            </div>

        </section>
    );
}
