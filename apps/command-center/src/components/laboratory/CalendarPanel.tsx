import { useMemo, useState, type KeyboardEvent } from "react";
import { Bell, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, StickyNote, Trash2 } from "lucide-react";
import { EVENT_TYPE_LABEL, type CalendarEvent, type CalendarEventType } from "../../state/calendarEvents";
import QuickToolModal from "./QuickToolModal";
import "./QuickToolModal.css";
import "./CalendarPanel.css";

interface CalendarPanelProps {
    onClose: () => void;
    events: CalendarEvent[];
    onAddEvent: (event: Omit<CalendarEvent, "id">) => void;
    onRemoveEvent: (id: string) => void;
}

type ViewMode = "day" | "week" | "month" | "year";

const VIEW_MODES: ViewMode[] = ["day", "week", "month", "year"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const TYPE_META: Record<CalendarEventType, { icon: typeof CalendarIcon; color: string }> = {
    event: { icon: CalendarIcon, color: "var(--primary)" },
    reminder: { icon: Bell, color: "var(--accent)" },
    note: { icon: StickyNote, color: "var(--secondary)" },
};

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

function toDateKey(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateKey(key: string): Date {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function startOfWeek(d: Date): Date {
    const res = new Date(d);
    const day = (res.getDay() + 6) % 7; // 0 = Monday
    res.setDate(res.getDate() - day);
    res.setHours(0, 0, 0, 0);
    return res;
}

function addDays(d: Date, n: number): Date {
    const res = new Date(d);
    res.setDate(res.getDate() + n);
    return res;
}

function addMonths(d: Date, n: number): Date {
    const res = new Date(d.getFullYear(), d.getMonth() + n, 1);
    return res;
}

function addYears(d: Date, n: number): Date {
    const res = new Date(d);
    res.setFullYear(res.getFullYear() + n);
    return res;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatFullDate(d: Date): string {
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/**
 * Laboratory's calendar — a real day/week/month/year picker (centered
 * QuickToolModal, wide variant) rather than the old flat "add an
 * event, type the date in yourself" list. Clicking any day sets it as
 * "focused" and the panel below the grid becomes that day's agenda —
 * see what's already there, add a note/reminder/event to exactly that
 * date, remove anything. Reads/writes the exact same shared event list
 * as the Dashboard's Upcoming Events widget (state/calendar.ts, owned
 * by App.tsx) — "jeden ucelenej kalendar" per original design intent,
 * unchanged by this rewrite.
 */
export default function CalendarPanel({ onClose, events, onAddEvent, onRemoveEvent }: CalendarPanelProps) {
    const today = useMemo(() => new Date(), []);
    const [view, setView] = useState<ViewMode>("month");
    const [focused, setFocused] = useState<Date>(today);
    const [newTitle, setNewTitle] = useState("");
    const [newTime, setNewTime] = useState("");
    const [newType, setNewType] = useState<CalendarEventType>("event");

    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        for (const event of events) {
            const list = map.get(event.date) ?? [];
            list.push(event);
            map.set(event.date, list);
        }
        return map;
    }, [events]);

    const focusedKey = toDateKey(focused);
    const focusedEvents = (eventsByDate.get(focusedKey) ?? []).slice().sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

    const goToday = () => setFocused(new Date());

    const navigate = (dir: 1 | -1) => {
        if (view === "day") setFocused((d) => addDays(d, dir));
        else if (view === "week") setFocused((d) => addDays(d, dir * 7));
        else if (view === "month") setFocused((d) => addMonths(d, dir));
        else setFocused((d) => addYears(d, dir));
    };

    const selectDay = (d: Date) => {
        setFocused(d);
        if (view === "year") setView("month");
    };

    const handleAdd = () => {
        if (!newTitle.trim()) return;
        onAddEvent({ title: newTitle.trim(), date: focusedKey, time: newTime || undefined, type: newType });
        setNewTitle("");
        setNewTime("");
        setNewType("event");
    };

    const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAdd();
        }
    };

    const headerLabel = view === "day"
        ? formatFullDate(focused)
        : view === "week"
            ? (() => {
                const start = startOfWeek(focused);
                const end = addDays(start, 6);
                const sameMonth = start.getMonth() === end.getMonth();
                return `${MONTH_LABELS[start.getMonth()]} ${start.getDate()}${sameMonth ? "" : ` ${MONTH_LABELS[end.getMonth()].slice(0, 3)}`} – ${end.getDate()}, ${end.getFullYear()}`;
            })()
            : view === "month"
                ? `${MONTH_LABELS[focused.getMonth()]} ${focused.getFullYear()}`
                : String(focused.getFullYear());

    return (
        <QuickToolModal title="Calendar" icon={CalendarIcon} onClose={onClose} wide>
            <div className="cal-panel-toolbar">
                <div className="cal-panel-nav">
                    <button type="button" className="cal-panel-nav-btn" onClick={() => navigate(-1)} aria-label="Previous">
                        <ChevronLeft size={15} strokeWidth={2} />
                    </button>
                    <span className="cal-panel-nav-label">{headerLabel}</span>
                    <button type="button" className="cal-panel-nav-btn" onClick={() => navigate(1)} aria-label="Next">
                        <ChevronRight size={15} strokeWidth={2} />
                    </button>
                    <button type="button" className="cal-panel-today-btn" onClick={goToday}>Today</button>
                </div>

                <div className="cal-panel-view-switch">
                    {VIEW_MODES.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            className={`cal-panel-view-btn${view === mode ? " cal-panel-view-btn-active" : ""}`}
                            onClick={() => setView(mode)}
                        >
                            {mode[0].toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {view === "month" && (
                <MonthGrid focused={focused} today={today} eventsByDate={eventsByDate} onSelectDay={selectDay} />
            )}
            {view === "week" && (
                <WeekGrid focused={focused} today={today} eventsByDate={eventsByDate} onSelectDay={selectDay} />
            )}
            {view === "day" && (
                <DayGrid focused={focused} today={today} />
            )}
            {view === "year" && (
                <YearGrid focused={focused} eventsByDate={eventsByDate} onSelectMonth={(d) => { setFocused(d); setView("month"); }} />
            )}

            <div className="cal-panel-agenda">
                <div className="cal-panel-agenda-header">{formatFullDate(focused)}</div>

                {focusedEvents.length === 0 ? (
                    <p className="cal-panel-agenda-empty">Nothing here yet.</p>
                ) : (
                    <div className="cal-panel-agenda-list">
                        {focusedEvents.map((event) => {
                            const meta = TYPE_META[event.type];
                            const Icon = meta.icon;
                            return (
                                <div key={event.id} className="cal-panel-agenda-item">
                                    <Icon size={13} strokeWidth={1.75} style={{ color: meta.color }} />
                                    <span className="cal-panel-agenda-item-title">{event.title}</span>
                                    <span className="cal-panel-agenda-item-meta">
                                        {EVENT_TYPE_LABEL[event.type]}{event.time ? ` · ${event.time}` : ""}
                                    </span>
                                    <button
                                        type="button"
                                        className="cal-panel-agenda-item-remove"
                                        onClick={() => onRemoveEvent(event.id)}
                                        aria-label="Remove"
                                    >
                                        <Trash2 size={13} strokeWidth={1.75} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="cal-panel-add">
                    <input
                        type="text"
                        className="cal-panel-add-input"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={handleTitleKeyDown}
                        placeholder="Add a note, reminder, or event to this day..."
                    />
                    <input
                        type="time"
                        className="cal-panel-add-time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        aria-label="Time (optional)"
                    />
                    <select
                        className="cal-panel-add-type"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as CalendarEventType)}
                        aria-label="Type"
                    >
                        {(Object.keys(EVENT_TYPE_LABEL) as CalendarEventType[]).map((t) => (
                            <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>
                        ))}
                    </select>
                    <button type="button" className="cal-panel-add-btn" onClick={handleAdd} disabled={!newTitle.trim()}>
                        <Plus size={15} strokeWidth={2} />
                    </button>
                </div>
            </div>
        </QuickToolModal>
    );
}

interface GridProps {
    focused: Date;
    today: Date;
    eventsByDate: Map<string, CalendarEvent[]>;
    onSelectDay: (d: Date) => void;
}

function MonthGrid({ focused, today, eventsByDate, onSelectDay }: GridProps) {
    const firstOfMonth = new Date(focused.getFullYear(), focused.getMonth(), 1);
    const gridStart = startOfWeek(firstOfMonth);
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

    return (
        <div className="cal-panel-grid">
            {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="cal-panel-weekday">{label}</div>
            ))}
            {days.map((day) => {
                const key = toDateKey(day);
                const count = eventsByDate.get(key)?.length ?? 0;
                const inMonth = day.getMonth() === focused.getMonth();
                const isToday = isSameDay(day, today);
                const isFocused = isSameDay(day, focused);
                return (
                    <button
                        key={key}
                        type="button"
                        className={`cal-panel-day${inMonth ? "" : " cal-panel-day-outside"}${isToday ? " cal-panel-day-today" : ""}${isFocused ? " cal-panel-day-focused" : ""}`}
                        onClick={() => onSelectDay(day)}
                    >
                        <span className="cal-panel-day-number">{day.getDate()}</span>
                        {count > 0 && <span className="cal-panel-day-dot" />}
                    </button>
                );
            })}
        </div>
    );
}

function WeekGrid({ focused, today, eventsByDate, onSelectDay }: GridProps) {
    const start = startOfWeek(focused);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    return (
        <div className="cal-panel-grid cal-panel-grid-week">
            {days.map((day, weekdayIndex) => {
                const key = toDateKey(day);
                const count = eventsByDate.get(key)?.length ?? 0;
                const isToday = isSameDay(day, today);
                const isFocused = isSameDay(day, focused);
                return (
                    <button
                        key={key}
                        type="button"
                        className={`cal-panel-week-day${isToday ? " cal-panel-day-today" : ""}${isFocused ? " cal-panel-day-focused" : ""}`}
                        onClick={() => onSelectDay(day)}
                    >
                        <span className="cal-panel-week-day-label">{WEEKDAY_LABELS[weekdayIndex]}</span>
                        <span className="cal-panel-day-number">{day.getDate()}</span>
                        {count > 0 && <span className="cal-panel-day-dot" />}
                    </button>
                );
            })}
        </div>
    );
}

function DayGrid({ focused, today }: { focused: Date; today: Date }) {
    const isToday = isSameDay(focused, today);
    return (
        <div className="cal-panel-day-view">
            <span className={`cal-panel-day-view-number${isToday ? " cal-panel-day-today" : ""}`}>{focused.getDate()}</span>
            <span className="cal-panel-day-view-label">{focused.toLocaleDateString(undefined, { weekday: "long" })}</span>
        </div>
    );
}

function YearGrid({ focused, eventsByDate, onSelectMonth }: {
    focused: Date;
    eventsByDate: Map<string, CalendarEvent[]>;
    onSelectMonth: (d: Date) => void;
}) {
    const monthHasEvents = (monthIndex: number) => {
        for (const key of eventsByDate.keys()) {
            const d = fromDateKey(key);
            if (d.getFullYear() === focused.getFullYear() && d.getMonth() === monthIndex) return true;
        }
        return false;
    };

    return (
        <div className="cal-panel-year-grid">
            {MONTH_LABELS.map((label, i) => (
                <button
                    key={label}
                    type="button"
                    className="cal-panel-year-month"
                    onClick={() => onSelectMonth(new Date(focused.getFullYear(), i, 1))}
                >
                    {label}
                    {monthHasEvents(i) && <span className="cal-panel-day-dot" />}
                </button>
            ))}
        </div>
    );
}
