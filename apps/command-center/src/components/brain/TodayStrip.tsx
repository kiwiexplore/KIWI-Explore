import { useEffect, useState } from "react";
import { useAsyncData } from "./regionContent/useAsyncData";
import { adventureData, newsData, spaceData, weatherData } from "./regionContent/dataSources";
import {
    articleStoryKey, launchStoryKey, liberecStoryKey, techStoryKey, worldStoryKey,
} from "./storyKeys";
import { describeWeatherCode } from "../../lib/weather";
import { daylightRemaining } from "../../lib/daylight";
import type { CalendarState } from "../../state/calendar";
import "./TodayStrip.css";

interface Tile {
    id: string;
    icon: string;
    /** What the tile is — "Weather", "Next up". */
    label: string;
    /** The fact itself. */
    value: string;
    regionId: string;
    moduleId: string;
    storyId?: string;
}

interface TodayStripProps {
    calendar: CalendarState;
    onOpen: (regionId: string, moduleId: string, storyId?: string) => void;
}

/**
 * What today amounts to, before you've opened anything.
 *
 * The dashboard used to say one thing at rest — "No new activity while
 * you were away" — and that sentence was hardcoded, with nothing behind
 * it. Everything real was a region away, which meant opening six of
 * them to find out whether anything mattered. That isn't a dashboard;
 * it's a menu.
 *
 * Each tile is one live fact and a way in: clicking it opens the region
 * and the module it came from, and where the fact IS a story, that
 * story. Prices are deliberately NOT among them any more — the markets
 * bar across the top of the screen carries those, and a tile repeating
 * one was a second copy of something already on screen. Nothing here is fetched twice — these are the same cache keys
 * and the same loaders the regions use (see dataSources), so the strip
 * warms the caches the regions will want anyway and opening one costs
 * nothing.
 *
 * Far more is gathered than fits — every source the dashboard has
 * already fetched, several items deep — and the strip rotates slowly
 * through all of it (per explicit request). Deep on purpose: a pool
 * barely bigger than the row means two pages that alternate, which
 * reads as the same handful of facts repeating. Slowly, too: twelve
 * seconds, because a row that changes while you're reading it is worse
 * than one that repeats.
 *
 * A tile whose source hasn't answered simply isn't rendered. The strip
 * is as long as there is news to put in it.
 */
// How many rotate in at a time, and how long they hold. Five, which is
// what fits on one row between the nav rail and the right edge without
// wrapping or clipping — the rest arrive on the next turn.
const TILE_WINDOW = 5;
const TILE_HOLD_MS = 12000;
export default function TodayStrip({ calendar, onOpen }: TodayStripProps) {
    const [offset, setOffset] = useState(0);
    const weather = useAsyncData("weather", weatherData);
    const news = useAsyncData("news", newsData);
    const space = useAsyncData("space", spaceData);
    const adventure = useAsyncData("adventure", adventureData);

    const tiles: Tile[] = [];

    if (weather.data) {
        const info = describeWeatherCode(weather.data.weather.code);
        tiles.push({
            id: "weather",
            icon: info.emoji,
            label: weather.data.location.label,
            value: `${Math.round(weather.data.weather.temperature)}°C · ${info.label}`,
            regionId: "occipital",
            moduleId: "weather",
        });
    }

    // The next thing with a date on it, today or later.
    const today = new Date().toISOString().slice(0, 10);
    calendar.events
        .filter((event) => event.date >= today)
        .sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`))
        .slice(0, 2)
        .forEach((event) => tiles.push({
            id: `calendar-${event.id ?? event.title}`,
            icon: "📅",
            label: event.time ? `${event.date} · ${event.time}` : event.date,
            value: event.title,
            regionId: "frontal",
            moduleId: "calendar",
        }));

    (news.data?.liberec ?? []).slice(0, 6).forEach((story) => tiles.push({
        id: `liberec-${story.id}`,
        icon: "📰",
        label: story.source,
        value: story.title,
        regionId: "occipital",
        moduleId: "news",
        storyId: liberecStoryKey(story.id),
    }));

    (news.data?.world ?? []).slice(0, 4).forEach((story) => tiles.push({
        id: `world-${story.id}`,
        icon: "🌍",
        label: story.title,
        value: story.text,
        regionId: "occipital",
        moduleId: "news",
        storyId: worldStoryKey(story.id),
    }));

    // Whichever coin moved furthest either way — the number worth
    // knowing is the biggest move, not the biggest coin.

    if (adventure.data) {
        const remaining = daylightRemaining(adventure.data.daylight);
        tiles.push({
            id: "daylight",
            icon: remaining > 0 ? "⛰️" : "🌙",
            label: remaining > 0 ? "Daylight left" : "After dark",
            value: remaining > 0
                ? `${Math.floor(remaining / 60)}h ${remaining % 60}m`
                : `Sunrise ${adventure.data.daylight.sunrise.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
            regionId: "temporal-right",
            moduleId: "adventure",
        });
    }

    (space.data?.launches ?? []).slice(0, 3).forEach((launch) => tiles.push({
        id: `launch-${launch.id}`,
        icon: "🚀",
        label: new Date(launch.net).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: launch.name,
        regionId: "occipital",
        moduleId: "space",
        storyId: launchStoryKey(launch.id),
    }));

    // Rotation is by whole windows, so a set holds still while it's
    // being read and then the next one arrives together.
    useEffect(() => {
        if (tiles.length <= TILE_WINDOW) return;
        const timer = window.setInterval(
            () => setOffset((current) => (current + TILE_WINDOW) % tiles.length),
            TILE_HOLD_MS,
        );
        return () => window.clearInterval(timer);
    }, [tiles.length]);

    if (tiles.length === 0) {
        return (
            <div className="today-strip">
                <span className="today-strip-waiting">Reading the day…</span>
            </div>
        );
    }

    const shown = tiles.length <= TILE_WINDOW
        ? tiles
        : Array.from({ length: TILE_WINDOW }, (_, i) => tiles[(offset + i) % tiles.length]);

    (news.data?.tech ?? []).slice(0, 3).forEach((story) => tiles.push({
        id: `tech-${story.id}`,
        icon: "💻",
        label: story.domain || "Hacker News",
        value: story.title,
        regionId: "occipital",
        moduleId: "news",
        storyId: techStoryKey(story.id),
    }));

    (space.data?.articles ?? []).slice(0, 3).forEach((article) => tiles.push({
        id: `article-${article.id}`,
        icon: "🛰️",
        label: article.newsSite,
        value: article.title,
        regionId: "occipital",
        moduleId: "space",
        storyId: articleStoryKey(article.id),
    }));

    return (
        <div className="today-strip">
            {shown.map((tile) => (
                <button
                    key={tile.id}
                    type="button"
                    className="today-tile"
                    onClick={() => onOpen(tile.regionId, tile.moduleId, tile.storyId)}
                >
                    <span className="today-tile-icon">{tile.icon}</span>
                    <span className="today-tile-text">
                        <span className="today-tile-label">{tile.label}</span>
                        <span className="today-tile-value">{tile.value}</span>
                    </span>
                </button>
            ))}
        </div>
    );
}
