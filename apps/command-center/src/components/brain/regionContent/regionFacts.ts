import { useMemo } from "react";
import { useAsyncData } from "./useAsyncData";
import {
    adventureData, entertainmentData, mealsData, newsData, spaceData, weatherData,
} from "./dataSources";
import type { RegionContentContext } from "./types";
import { describeWeatherCode } from "../../../lib/weather";
import { fetchFinanceNews } from "../../../lib/financeNews";
import { daylightRemaining } from "../../../lib/daylight";
import type { BrainRegionDefinition } from "../../../state/brainRegions";
import {
    articleStoryKey, financeStoryKey, launchStoryKey, liberecStoryKey, recipeStoryKey,
    techStoryKey, worldStoryKey,
} from "../storyKeys";

// Long strings turn the pins into billboards that cover the network
// they're supposed to be sitting in.
const MAX_LENGTH = 46;

function short(text: string): string {
    const clean = text.trim();
    return clean.length <= MAX_LENGTH ? clean : `${clean.slice(0, MAX_LENGTH - 1)}…`;
}

export interface RegionFact {
    text: string;
    /**
     * Which of the region's modules this fact came from — clicking the
     * pin opens exactly that module's panel (see RegionDataPins), so a
     * fact is never a dead end.
     */
    moduleId: string;
    /**
     * The one story this fact stands for, where it stands for one —
     * see storyKeys. With it, clicking the pin opens that headline
     * itself rather than the list it's in, and opening the headline in
     * the panel turns the camera to this pin. Facts that summarise a
     * whole module (a project's progress, today's temperature) have no
     * story to open and leave it unset.
     */
    storyId?: string;
}

/**
 * Short one-line facts about a region, for the pins that sit on its
 * neurons once you fly into it (see RegionDataPins) — the region's own
 * subject matter, attached to its own wiring.
 *
 * Deliberately built on the exact same cache keys the region panel's
 * modules use (see LiveModules): flying into a region and reading its
 * panel hit one fetch between them, not two.
 *
 * Only the sources the given region actually needs are requested — the
 * rest are called with a null key, which is how useAsyncData lets a
 * caller opt out without a conditional hook.
 */
export function useRegionFacts(region: BrainRegionDefinition | null, context: RegionContentContext): RegionFact[] {
    const id = region?.id ?? null;

    const weather = useAsyncData(id === "occipital" ? "weather" : null, weatherData);
    const news = useAsyncData(id === "occipital" ? "news" : null, newsData);
    const space = useAsyncData(id === "occipital" ? "space" : null, spaceData);
    const entertainment = useAsyncData(id === "temporal-right" ? "entertainment" : null, entertainmentData);
    const financeNews = useAsyncData(id === "frontal" ? "finance-news" : null, () => fetchFinanceNews(12));
    const adventure = useAsyncData(id === "temporal-right" ? "adventure" : null, adventureData);
    const meals = useAsyncData(id === "stem" ? "meals" : null, mealsData);

    const { calendar, laboratoryData } = context;

    return useMemo(() => {
        if (!region) return [];
        const facts: RegionFact[] = [];
        const add = (moduleId: string, text: string, storyId?: string) =>
            facts.push({ moduleId, text: short(text), storyId });

        if (id === "frontal") {
            laboratoryData.projects.forEach((project) => add("projects", `${project.name} · ${project.progress}%`));
            const today = new Date().toISOString().slice(0, 10);
            calendar.events
                .filter((event) => event.date >= today)
                .forEach((event) => add("calendar", `${event.time ?? event.date} · ${event.title}`));
            financeNews.data?.forEach((story) => add("finance", story.title, financeStoryKey(story.id)));
        }

        if (id === "parietal") {
            laboratoryData.notes.forEach((note) => add("documents", note.title));
            laboratoryData.researchEntries.forEach((entry) => add("documents", entry.title));
        }

        if (id === "occipital") {
            news.data?.liberec.forEach((story) => add("news", story.title, liberecStoryKey(story.id)));
            news.data?.world.forEach((story) => add("news", story.text, worldStoryKey(story.id)));
            news.data?.tech.forEach((story) => add("news", story.title, techStoryKey(story.id)));
            space.data?.launches.forEach((launch) => add("space", `🚀 ${launch.name}`, launchStoryKey(launch.id)));
            space.data?.articles.forEach((article) => add("space", article.title, articleStoryKey(article.id)));
            if (weather.data) {
                const info = describeWeatherCode(weather.data.weather.code);
                add("weather", `${info.emoji} ${Math.round(weather.data.weather.temperature)}°C · ${weather.data.location.label}`);
            }
        }

        if (id === "temporal-right") {
            entertainment.data?.shows.forEach((show) => add("entertainment", `📺 ${show.showName}`));
            entertainment.data?.songs.forEach((song) => add("entertainment", `♪ ${song.name} · ${song.artist}`));
            if (adventure.data) {
                const remaining = daylightRemaining(adventure.data.daylight);
                add("adventure", remaining > 0
                    ? `☀️ ${Math.floor(remaining / 60)}h ${remaining % 60}m of daylight left`
                    : "🌙 After dark");
            }
        }

        if (id === "stem") {
            meals.data?.forEach((recipe) => add("meals", `🍳 ${recipe.name}`, recipeStoryKey(recipe.id)));
        }

        // Regions with no live source of their own (and any region whose
        // own data hasn't arrived yet) still get something to send down
        // the wires: what that area is FOR. Better than empty wiring,
        // and it's the region's real subject matter either way.
        if (facts.length === 0) {
            region.modules.forEach((module) => add(module.id, `${module.icon} ${module.label}`));
        }

        return facts;
    }, [
        region, id, calendar.events, laboratoryData,
        news.data, space.data, weather.data, entertainment.data,
        financeNews.data, adventure.data, meals.data,
    ]);
}
