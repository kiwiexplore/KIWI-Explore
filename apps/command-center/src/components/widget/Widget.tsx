import Panel from "../ui/Panel";
import type { WidgetDefinition } from "../../types/widget";

interface WidgetProps {
    definition: WidgetDefinition;
}

/**
 * Generic renderer for a WidgetDefinition.
 * This is intentionally "dumb" — it knows nothing about News, Finance,
 * Space, etc. It just renders whatever data/content the definition holds.
 */
export default function Widget({ definition }: WidgetProps) {
    return (
        <Panel title={definition.title}>
            {definition.body}
        </Panel>
    );
}
