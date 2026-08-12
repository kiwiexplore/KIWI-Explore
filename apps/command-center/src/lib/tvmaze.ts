// Live TV schedule via the TVMaze API (https://www.tvmaze.com/api) —
// free, public, no key required, CORS-enabled for direct browser
// fetches. Shows what's airing today (US schedule), filtered to
// primetime entries with an image so the list stays relevant instead
// of listing every early-morning local news rerun.

export interface TVEntry {
    id: number;
    showName: string;
    episodeName: string;
    airtime: string;
    network: string;
    image: string;
}

export async function fetchTodaysSchedule(limit = 6): Promise<TVEntry[]> {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`https://api.tvmaze.com/schedule?country=US&date=${today}`);
    if (!res.ok) throw new Error(`TVMaze API request failed: ${res.status}`);
    const data = await res.json();

    return (data as Array<{
        id: number; name: string; airtime: string;
        show?: { name: string; image?: { medium: string }; network?: { name: string } };
    }>)
        .filter((e) => e.show?.image && e.airtime >= "18:00")
        .map((e) => ({
            id: e.id,
            showName: e.show!.name,
            episodeName: e.name,
            airtime: e.airtime,
            network: e.show!.network?.name ?? "",
            image: e.show!.image!.medium,
        }))
        .slice(0, limit);
}
