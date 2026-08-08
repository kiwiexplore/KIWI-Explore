import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import "./ItemPicker.css";

export interface PickerItem {
    id: string;
    label: string;
    icon?: string; // emoji, optional
}

interface ItemPickerProps {
    allItems: PickerItem[];
    activeIds: string[];
    maxCount: number;
    onChange: (nextActiveIds: string[]) => void;
}

/**
 * Reusable "pick up to N, in this order" list editor — used for the
 * orbit icons and both widget columns in ProfileSettings. Two regions:
 * the active set (in its current order, with up/down + remove controls)
 * and the remaining available items (each with an add button, disabled
 * once the plan's limit is reached). Reordering is up/down buttons
 * rather than drag-and-drop — reliable inside a small floating,
 * backdrop-blurred, possibly-scrolling drawer, where native HTML5 drag
 * events are fragile (touch support, scroll-while-dragging, stacking
 * context with the 3D canvas behind it).
 */
export default function ItemPicker({ allItems, activeIds, maxCount, onChange }: ItemPickerProps) {
    const byId = new Map(allItems.map((item) => [item.id, item]));
    const active = activeIds.map((id) => byId.get(id)).filter((item): item is PickerItem => Boolean(item));
    const available = allItems.filter((item) => !activeIds.includes(item.id));
    const atLimit = active.length >= maxCount;

    const move = (index: number, direction: -1 | 1) => {
        const next = [...activeIds];
        const target = index + direction;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const remove = (id: string) => onChange(activeIds.filter((activeId) => activeId !== id));
    const add = (id: string) => { if (!atLimit) onChange([...activeIds, id]); };

    return (
        <div className="item-picker">
            <div className="item-picker-count">{active.length} / {maxCount} active</div>

            <div className="item-picker-list">
                {active.map((item, i) => (
                    <div key={item.id} className="item-picker-row item-picker-row-active">
                        {item.icon && <span className="item-picker-emoji">{item.icon}</span>}
                        <span className="item-picker-label">{item.label}</span>
                        <div className="item-picker-controls">
                            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                                <ArrowUp size={13} strokeWidth={2} />
                            </button>
                            <button type="button" disabled={i === active.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                                <ArrowDown size={13} strokeWidth={2} />
                            </button>
                            <button type="button" onClick={() => remove(item.id)} aria-label="Remove" className="item-picker-remove">
                                <X size={13} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                ))}
                {active.length === 0 && <div className="item-picker-empty">Nothing active yet — add some below.</div>}
            </div>

            {available.length > 0 && (
                <>
                    <div className="item-picker-subheading">Available</div>
                    <div className="item-picker-list">
                        {available.map((item) => (
                            <div key={item.id} className="item-picker-row">
                                {item.icon && <span className="item-picker-emoji">{item.icon}</span>}
                                <span className="item-picker-label">{item.label}</span>
                                <button
                                    type="button"
                                    className="item-picker-add"
                                    onClick={() => add(item.id)}
                                    disabled={atLimit}
                                    aria-label="Add"
                                    title={atLimit ? "Reached your plan's limit" : "Add"}
                                >
                                    <Plus size={13} strokeWidth={2} />
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
