/**
 * Timecode, shared between the editor and its timeline.
 *
 * Its own file because a module that exports a component AND a helper
 * breaks fast refresh — the editor would lose its playhead on every
 * save while it's being built.
 */
export function formatClock(seconds: number): string {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const rest = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${rest}`;
}
