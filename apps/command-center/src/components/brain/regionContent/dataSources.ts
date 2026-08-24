import { fetchWeather, resolveLocation } from "../../../lib/weather";
import { fetchTopStories } from "../../../lib/hackerNews";
import { fetchSpaceNews } from "../../../lib/spaceNews";
import { fetchUpcomingLaunches } from "../../../lib/spaceMissions";
import { fetchTodaysSchedule } from "../../../lib/tvmaze";
import { fetchTopSongs } from "../../../lib/itunes";
import { fetchCoins, fetchGlobalCrypto, fetchPairs, type RatePair } from "../../../lib/markets";
import { fetchIndices, type MarketSpan } from "../../../lib/indices";
import { fetchWorldNews } from "../../../lib/worldNews";
import { fetchLiberecNews } from "../../../lib/liberecNews";
import { fetchDaylight } from "../../../lib/daylight";
import { fetchProteinRecipes } from "../../../lib/recipes";

/**
 * One loader per cache key, in one place.
 *
 * useAsyncData caches by KEY and ignores the loader when it already has
 * an answer (see useAsyncData) — which means two callers using the same
 * key with different loaders is a real trap: whichever mounts first
 * decides the SHAPE the other one receives, and the second reads
 * fields that aren't there. The modules, the pins and the overview all
 * ask for the same things, so the loader has to be the same function,
 * not three copies that happen to agree today.
 *
 * `settle` is here for the same reason it's used inside the loaders: a
 * section made of several feeds must lose only the feed that failed.
 */

function settle<T>(promise: Promise<T[]>): Promise<T[]> {
    return promise.catch((): T[] => []);
}

export async function weatherData() {
    const location = await resolveLocation();
    return { location, weather: await fetchWeather(location.latitude, location.longitude) };
}

export async function newsData() {
    const [liberec, world, tech] = await Promise.all([
        settle(fetchLiberecNews(10)), settle(fetchWorldNews(8)), settle(fetchTopStories(6)),
    ]);
    return { liberec, world, tech };
}

export async function spaceData() {
    const [launches, articles] = await Promise.all([fetchUpcomingLaunches(4), fetchSpaceNews(5)]);
    return { launches, articles };
}

export async function entertainmentData() {
    const [shows, songs] = await Promise.all([fetchTodaysSchedule(6), fetchTopSongs(6)]);
    return { shows, songs };
}

/**
 * Coins and rates, over whichever four currencies are chosen.
 *
 * Keyed by those four upstream (see MarketTicker), because they are a
 * choice the reader makes and each set is a different answer — the same
 * reasoning the span already gets. Without the key in the cache, picking
 * a new currency would show the old four until something else happened
 * to invalidate them.
 */
export function marketsFor(pairs: RatePair[]) {
    return async () => {
        const [coins, rates, global] = await Promise.all([
            fetchCoins(15), fetchPairs(pairs), fetchGlobalCrypto(),
        ]);
        return { coins, rates, global };
    };
}

/**
 * The boards that come through KIWI's own service, over one span.
 *
 * Separate from marketsData and keyed by span, because the span is a
 * choice the reader makes and each one is a genuinely different answer
 * — while the coins and the rates are the same whichever chart period
 * is on screen.
 */
export function indicesFor(span: MarketSpan) {
    return () => settle(fetchIndices(span));
}

export async function adventureData() {
    const location = await resolveLocation();
    const [daylight, weather] = await Promise.all([
        fetchDaylight(location.latitude, location.longitude),
        fetchWeather(location.latitude, location.longitude),
    ]);
    return { location, daylight, weather };
}

export const mealsData = () => fetchProteinRecipes(5);
