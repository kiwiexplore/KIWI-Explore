// Live upcoming launches via The Space Devs' Launch Library 2
// (https://ll.thespacedevs.com/) — free, public, no API key required,
// CORS-enabled for direct browser fetches. Third live-data widget
// alongside weather/space-news — see SpaceMissionsWidget. Rate-limited
// to 15 requests/hour on the public tier, which is plenty for a widget
// that only fetches once per mount.

export interface SpaceMission {
    id: string;
    name: string;
    net: string; // ISO datetime of the launch window
    statusName: string;
    provider: string;
    padName: string;
    locationName: string;
    imageUrl: string | null;
    missionDescription: string | null;
}

export async function fetchUpcomingLaunches(limit = 5): Promise<SpaceMission[]> {
    const res = await fetch(`https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=${limit}&mode=normal`);
    if (!res.ok) throw new Error(`Launch Library request failed: ${res.status}`);
    const data = await res.json();

    return (data.results ?? []).map((l: {
        id: string; name: string; net: string;
        status?: { name: string }; launch_service_provider?: { name: string };
        pad?: { name: string; location?: { name: string } };
        image?: string; mission?: { description: string };
    }) => ({
        id: l.id,
        name: l.name,
        net: l.net,
        statusName: l.status?.name ?? "Unknown",
        provider: l.launch_service_provider?.name ?? "Unknown",
        padName: l.pad?.name ?? "",
        locationName: l.pad?.location?.name ?? "",
        imageUrl: l.image ?? null,
        missionDescription: l.mission?.description ?? null,
    }));
}
