import { useAsyncData } from "./useAsyncData";
import StoryCard from "./StoryCard";
import StoryReader, { type StoryDetail } from "./StoryReader";
import Sparkline from "./Sparkline";
import type { ModuleViewProps } from "./types";
import {
    describeUvIndex, describeWeatherCode, describeWindDirection, fetchWeather, resolveLocation,
    type WeatherData, type WeatherLocation,
} from "../../../lib/weather";
import { fetchTopStories } from "../../../lib/hackerNews";
import { fetchSpaceNews } from "../../../lib/spaceNews";
import { fetchUpcomingLaunches } from "../../../lib/spaceMissions";
import { fetchTodaysSchedule } from "../../../lib/tvmaze";
import { fetchTopSongs } from "../../../lib/itunes";
import { fetchCoins, fetchRates } from "../../../lib/markets";
import { fetchWorldNews } from "../../../lib/worldNews";
import { fetchLiberecNews } from "../../../lib/liberecNews";
import { fetchDaylight, daylightRemaining } from "../../../lib/daylight";
import { fetchProteinRecipes, type Recipe } from "../../../lib/recipes";
import { removeSavedRecipe, toggleSavedRecipe, useSavedRecipes } from "../../../state/savedRecipes";
import {
    articleStoryKey, launchStoryKey, liberecStoryKey, recipeStoryKey, techStoryKey, worldStoryKey,
} from "../storyKeys";

/**
 * The region modules backed by real, live data — the free/keyless,
 * CORS-enabled APIs this app already talks to directly with no backend
 * of its own (see each lib/ file).
 *
 * These used to be the side-column widgets that the brain-first layout
 * removed; the data layer was always the valuable half of them, so it's
 * reused here rather than rewritten. What changed is where the result
 * lands: each module renders a one-line summary on its row in the region
 * overview AND the full contents when opened, from the same fetch.
 *
 * Anything with a story in it goes through StoryCard — picture,
 * headline and a couple of sentences — so the panel answers "is this
 * worth opening" without a trip to the browser and back. Clicking one
 * opens it in full inside the panel (StoryReader), with the link out at
 * the bottom of that: the decision to leave comes after reading, not
 * before.
 *
 * Which story is open is not held here but in the context passed down
 * (see types.ts): opening one turns the CAMERA to that story's own spot
 * inside the region, and the same story opens from out there by
 * clicking the pin sitting on that spot. A module keeps only the part
 * no one else can know — which of ITS items that key means, and what a
 * reader should show for it.
 */

function Loading({ mode }: { mode: string }) {
    return <span className="module-muted">{mode === "summary" ? "…" : "Loading…"}</span>;
}

function Failed({ mode }: { mode: string }) {
    return <span className="module-muted">{mode === "summary" ? "unavailable" : "Couldn't load this right now — check your connection and try again."}</span>;
}

function formatClock(value: string | Date): string {
    const date = typeof value === "string" ? new Date(value) : value;
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatWeekday(value: string): string {
    return new Date(value).toLocaleDateString(undefined, { weekday: "short" });
}

export function WeatherModule({ mode }: ModuleViewProps) {
    const { data, error, loading } = useAsyncData("weather", async () => {
        const location = await resolveLocation();
        const weather = await fetchWeather(location.latitude, location.longitude);
        return { location, weather };
    });

    if (loading) return <Loading mode={mode} />;
    if (error || !data) return <Failed mode={mode} />;

    const { location, weather } = data as { location: WeatherLocation; weather: WeatherData };
    const info = describeWeatherCode(weather.code);

    if (mode === "summary") {
        return <>{info.emoji} {Math.round(weather.temperature)}°C · {info.label} · {location.label}</>;
    }

    const today = weather.daily[0];

    return (
        <div className="module-detail">
            <div className="module-headline">
                <span className="module-headline-figure">{info.emoji} {Math.round(weather.temperature)}°C</span>
                <span className="module-headline-note">{info.label} · feels like {Math.round(weather.feelsLike)}°C · 📍 {location.label}</span>
            </div>

            {/* Everything the current-conditions call returns, laid out
                as facts rather than prose: at a glance you want the
                numbers, not a sentence built out of them. */}
            <div className="module-facts">
                <span>💧 {weather.humidity}% humidity</span>
                <span>💨 {describeWindDirection(weather.windDirection)} {Math.round(weather.windSpeed)} km/h</span>
                <span>🌬️ gusts {Math.round(weather.windGusts)} km/h</span>
                <span>☁️ {weather.cloudCover}% cloud</span>
                <span>🌡️ {Math.round(weather.pressure)} hPa</span>
                {weather.precipitation > 0 && <span>🌧️ {weather.precipitation} mm/h</span>}
            </div>

            {today && (
                <div className="module-facts">
                    <span>🌅 {formatClock(today.sunrise)}</span>
                    <span>🌇 {formatClock(today.sunset)}</span>
                    <span>☂️ {today.rainChance}% today</span>
                    <span>🔆 UV {Math.round(today.uvMax)} · {describeUvIndex(today.uvMax)}</span>
                </div>
            )}

            {weather.hourly.length > 0 && (
                <>
                    <h4 className="module-subhead">Next 24 hours</h4>
                    {/* A scrolling strip rather than a list: the point of
                        the next day is its SHAPE — when the rain arrives,
                        when it cools off — and twenty-four rows bury
                        that under everything else in the panel. */}
                    <div className="module-hours">
                        {weather.hourly.map((hour) => (
                            <div key={hour.time} className={`module-hour${hour.isDay ? "" : " module-hour-night"}`}>
                                <span className="module-hour-time">{formatClock(hour.time)}</span>
                                <span className="module-hour-icon">{describeWeatherCode(hour.code).emoji}</span>
                                <span className="module-hour-temp">{Math.round(hour.temperature)}°</span>
                                <span className="module-hour-rain">{hour.rainChance}%</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <h4 className="module-subhead">Week ahead</h4>
            <ul className="module-list">
                {weather.daily.map((day) => {
                    const dayInfo = describeWeatherCode(day.code);
                    return (
                        <li key={day.date} className="module-day">
                            <span className="module-row-lead">{formatWeekday(day.date)}</span>
                            <span className="module-day-sky">{dayInfo.emoji} {dayInfo.label}</span>
                            <span className="module-row-trail">{Math.round(day.max)}° / {Math.round(day.min)}°</span>
                            <span className="module-day-detail">
                                ☂️ {day.rainChance}%{day.rainTotal > 0 ? ` · ${day.rainTotal} mm` : ""}
                                {" · "}💨 {Math.round(day.windMax)} km/h
                                {" · "}🔆 UV {Math.round(day.uvMax)}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export function NewsModule({ mode, context }: ModuleViewProps) {
    // Three feeds, because they answer three different questions: what's
    // happening HERE, what's happening in the world, and what's
    // happening in tech. Shown in that order — the section about the
    // place you're standing in goes first — and fetched together, the
    // same way Space does with launches and articles.
    //
    // One failing feed must not take the other two down with it, which
    // is why each is caught on its own rather than through
    // Promise.all's all-or-nothing: the regional feed is a single
    // publisher's RSS, by far the most likely of the three to be down.
    const { data, error, loading } = useAsyncData("news", async () => {
        const settle = <T,>(promise: Promise<T[]>) => promise.catch((): T[] => []);
        const [liberec, world, tech] = await Promise.all([
            settle(fetchLiberecNews(10)), settle(fetchWorldNews(8)), settle(fetchTopStories(6)),
        ]);
        return { liberec, world, tech };
    });

    if (loading) return <Loading mode={mode} />;
    if (error || !data) return <Failed mode={mode} />;

    const { liberec, world, tech } = data;
    if (liberec.length === 0 && world.length === 0 && tech.length === 0) return <Failed mode={mode} />;
    if (mode === "summary") return <>{liberec[0]?.title ?? world[0]?.text ?? tech[0]?.title}</>;

    const open = context.openStoryId;
    const localStory = liberec.find((story) => liberecStoryKey(story.id) === open);
    const worldStory = world.find((story) => worldStoryKey(story.id) === open);
    const techStory = tech.find((story) => techStoryKey(story.id) === open);

    if (localStory) {
        return (
            <StoryReader
                story={{
                    title: localStory.title,
                    subtitle: [localStory.source, localStory.category, new Date(localStory.publishedAt).toLocaleString()]
                        .filter(Boolean).join(" · "),
                    image: localStory.image,
                    body: localStory.summary,
                    url: localStory.url,
                    sourceLabel: `Číst celý článek — ${localStory.source}`,
                }}
                backLabel="News"
                onBack={() => context.openStory(null)}
            />
        );
    }

    if (worldStory) {
        return (
            <StoryReader
                story={{
                    title: worldStory.text,
                    subtitle: [worldStory.title, worldStory.description].filter(Boolean).join(" · "),
                    image: worldStory.image,
                    body: worldStory.summary,
                    url: worldStory.url,
                    sourceLabel: "Read the full article on Wikipedia",
                }}
                backLabel="News"
                onBack={() => context.openStory(null)}
            />
        );
    }

    if (techStory) {
        return (
            <StoryReader
                story={{
                    title: techStory.title,
                    subtitle: techStory.domain || "news.ycombinator.com",
                    // Link posts have no text of their own anywhere in
                    // the API — the reader says so rather than opening
                    // an empty page.
                    body: techStory.excerpt
                        || "Hacker News carries no summary for link posts — only the headline, the score and the thread.",
                    facts: [
                        { label: "Points", value: String(techStory.score) },
                        { label: "Comments", value: String(techStory.comments) },
                        { label: "Posted by", value: techStory.by },
                    ],
                    url: techStory.url,
                    sourceLabel: techStory.domain ? `Open on ${techStory.domain}` : "Open the thread",
                }}
                backLabel="News"
                onBack={() => context.openStory(null)}
            />
        );
    }

    return (
        <div className="module-detail">
            {liberec.length > 0 && (
                <>
                    <h4 className="module-subhead">Liberec &amp; Liberecký kraj</h4>
                    <ul className="module-list">
                        {liberec.map((story) => (
                            <li key={story.id}>
                                <StoryCard
                                    title={story.title}
                                    excerpt={story.summary}
                                    meta={[story.source, story.category, new Date(story.publishedAt).toLocaleDateString()]
                                        .filter(Boolean).join(" · ")}
                                    image={story.image}
                                    onOpen={() => context.openStory(liberecStoryKey(story.id))}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {world.length > 0 && (
                <>
                    <h4 className="module-subhead">World</h4>
                    <ul className="module-list">
                        {world.map((story) => (
                            <li key={story.id}>
                                <StoryCard
                                    title={story.text}
                                    excerpt={story.excerpt}
                                    meta={[story.title, story.description].filter(Boolean).join(" · ")}
                                    image={story.image}
                                    onOpen={() => context.openStory(worldStoryKey(story.id))}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {tech.length > 0 && (
                <>
                    <h4 className="module-subhead">Tech</h4>
                    <ul className="module-list">
                        {tech.map((story) => (
                            <li key={story.id}>
                                <StoryCard
                                    title={story.title}
                                    excerpt={story.excerpt}
                                    meta={[story.domain, `${story.score} points`, `${story.comments} comments`]
                                        .filter(Boolean).join(" · ")}
                                    onOpen={() => context.openStory(techStoryKey(story.id))}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

export function SpaceModule({ mode, context }: ModuleViewProps) {
    const { data, error, loading } = useAsyncData("space", async () => {
        // Launches and articles are two different sources, but they're
        // one subject as far as the reader is concerned — the module
        // shows what's flying next, then what's being written about it.
        const [launches, articles] = await Promise.all([fetchUpcomingLaunches(4), fetchSpaceNews(5)]);
        return { launches, articles };
    });

    if (loading) return <Loading mode={mode} />;
    if (error || !data) return <Failed mode={mode} />;

    const { launches, articles } = data;

    if (mode === "summary") {
        const next = launches[0];
        return <>{next ? `Next launch: ${next.name}` : articles[0]?.title ?? "Nothing scheduled"}</>;
    }

    const open = context.openStoryId;
    const launch = launches.find((item) => launchStoryKey(item.id) === open);
    const article = articles.find((item) => articleStoryKey(item.id) === open);

    if (launch) {
        return (
            <StoryReader
                story={{
                    title: launch.name,
                    subtitle: `${launch.provider} · ${new Date(launch.net).toLocaleString()}`,
                    image: launch.imageUrl,
                    body: launch.missionDescription
                        ?? "Launch Library lists no mission description for this one yet.",
                    facts: [
                        { label: "Status", value: launch.statusName },
                        { label: "Pad", value: launch.padName || "—" },
                        { label: "Site", value: launch.locationName || "—" },
                    ],
                    url: launch.infoUrl ?? undefined,
                    sourceLabel: "More on this launch",
                }}
                backLabel="Space"
                onBack={() => context.openStory(null)}
            />
        );
    }

    if (article) {
        return (
            <StoryReader
                story={{
                    title: article.title,
                    subtitle: `${article.newsSite} · ${new Date(article.publishedAt).toLocaleString()}`,
                    image: article.imageUrl,
                    body: article.summary,
                    url: article.url,
                    sourceLabel: `Read it on ${article.newsSite}`,
                }}
                backLabel="Space"
                onBack={() => context.openStory(null)}
            />
        );
    }

    return (
        <div className="module-detail">
            {launches.length > 0 && (
                <>
                    <h4 className="module-subhead">Upcoming launches</h4>
                    <ul className="module-list">
                        {launches.map((launch) => (
                            <li key={launch.id}>
                                <button
                                    type="button"
                                    className="module-row module-row-button"
                                    onClick={() => context.openStory(launchStoryKey(launch.id))}
                                >
                                    <span className="module-row-lead">{new Date(launch.net).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                    <span>{launch.name}</span>
                                    <span className="module-row-trail">{launch.provider}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {articles.length > 0 && (
                <>
                    <h4 className="module-subhead">Space news</h4>
                    <ul className="module-list">
                        {articles.map((article) => (
                            <li key={article.id}>
                                <StoryCard
                                    title={article.title}
                                    excerpt={article.summary}
                                    meta={`${article.newsSite} · ${new Date(article.publishedAt).toLocaleDateString()}`}
                                    image={article.imageUrl}
                                    onOpen={() => context.openStory(articleStoryKey(article.id))}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

export function EntertainmentModule({ mode }: ModuleViewProps) {
    const { data, error, loading } = useAsyncData("entertainment", async () => {
        const [shows, songs] = await Promise.all([fetchTodaysSchedule(6), fetchTopSongs(6)]);
        return { shows, songs };
    });

    if (loading) return <Loading mode={mode} />;
    if (error || !data) return <Failed mode={mode} />;

    const { shows, songs } = data;

    if (mode === "summary") {
        return <>{shows[0] ? `Tonight: ${shows[0].showName}` : songs[0] ? `#1 ${songs[0].name}` : "Nothing on"}</>;
    }

    return (
        <div className="module-detail">
            {shows.length > 0 && (
                <>
                    <h4 className="module-subhead">On today</h4>
                    <ul className="module-list">
                        {shows.map((show) => (
                            <li key={show.id} className="module-row">
                                <span className="module-row-lead">{show.airtime || "—"}</span>
                                <span>{show.showName}</span>
                                <span className="module-row-trail">{show.network}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {songs.length > 0 && (
                <>
                    <h4 className="module-subhead">Top songs</h4>
                    <ul className="module-list">
                        {songs.map((song, index) => (
                            <li key={song.id} className="module-row">
                                <span className="module-row-lead">{index + 1}</span>
                                <span>{song.name}</span>
                                <span className="module-row-trail">{song.artist}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

function formatPrice(value: number): string {
    if (value >= 1000) return `$${Math.round(value).toLocaleString()}`;
    if (value >= 1) return `$${value.toFixed(2)}`;
    return `$${value.toFixed(4)}`;
}

export function FinanceModule({ mode }: ModuleViewProps) {
    const { data, error, loading } = useAsyncData("markets", async () => {
        const [coins, rates] = await Promise.all([fetchCoins(6), fetchRates()]);
        return { coins, rates };
    });

    if (loading) return <Loading mode={mode} />;
    if (error || !data) return <Failed mode={mode} />;

    const { coins, rates } = data;

    if (mode === "summary") {
        const lead = coins[0];
        if (!lead) return <>{rates.rates.map((rate) => `${rate.code} ${rate.rate.toFixed(2)}`).join(" · ")}</>;
        return <>{lead.symbol} {formatPrice(lead.price)} {lead.change24h >= 0 ? "▲" : "▼"} {Math.abs(lead.change24h).toFixed(1)}%</>;
    }

    return (
        <div className="module-detail">
            <h4 className="module-subhead">Crypto · 24h · 7d line</h4>
            <ul className="module-list">
                {coins.map((coin) => (
                    <li key={coin.id} className="module-coin">
                        <span className="module-row-lead">{coin.symbol}</span>
                        <span className="module-coin-price">{formatPrice(coin.price)}</span>
                        <Sparkline values={coin.week} rising={coin.change24h >= 0} />
                        {/* The arrow carries the direction as well as the
                            colour does — a red/green-only signal is
                            invisible to a good few readers. */}
                        <span className={`module-row-trail ${coin.change24h >= 0 ? "module-up" : "module-down"}`}>
                            {coin.change24h >= 0 ? "▲" : "▼"} {Math.abs(coin.change24h).toFixed(1)}%
                        </span>
                    </li>
                ))}
            </ul>

            <h4 className="module-subhead">Rates · {rates.base} · {rates.date}</h4>
            <ul className="module-list">
                {rates.rates.map((rate) => (
                    <li key={rate.code} className="module-row">
                        <span className="module-row-lead">{rate.code}</span>
                        <span>{rate.rate.toFixed(3)}</span>
                        <span className="module-row-trail">per 1 {rates.base}</span>
                    </li>
                ))}
            </ul>

            <p className="module-note">
                Stocks and indices need an API key, so they aren't here yet.
            </p>
        </div>
    );
}

export function AdventureModule({ mode }: ModuleViewProps) {
    // The two halves of "should I go out today": how much light is left,
    // and what the sky is doing. Both keyed off the same location.
    const { data, error, loading } = useAsyncData("adventure", async () => {
        const location = await resolveLocation();
        const [daylight, weather] = await Promise.all([
            fetchDaylight(location.latitude, location.longitude),
            fetchWeather(location.latitude, location.longitude),
        ]);
        return { location, daylight, weather };
    });

    if (loading) return <Loading mode={mode} />;
    if (error || !data) return <Failed mode={mode} />;

    const { location, daylight, weather } = data;
    const remaining = daylightRemaining(daylight);
    const hours = Math.floor(remaining / 60);
    const minutes = remaining % 60;
    const info = describeWeatherCode(weather.code);

    if (mode === "summary") {
        return remaining > 0
            ? <>{hours}h {minutes}m of daylight · {info.emoji} {Math.round(weather.temperature)}°C</>
            : <>Dark now · sunrise {formatClock(daylight.sunrise)}</>;
    }

    return (
        <div className="module-detail">
            <div className="module-headline">
                <span className="module-headline-figure">
                    {remaining > 0 ? `${hours}h ${minutes}m left` : "After dark"}
                </span>
                <span className="module-headline-note">
                    {info.label} · {Math.round(weather.temperature)}°C · 💨 {describeWindDirection(weather.windDirection)} {Math.round(weather.windSpeed)} km/h · 📍 {location.label}
                </span>
            </div>

            <ul className="module-list">
                <li className="module-row">
                    <span className="module-row-lead">First light</span>
                    <span>{formatClock(daylight.firstLight)}</span>
                    <span className="module-row-trail">civil dawn</span>
                </li>
                <li className="module-row">
                    <span className="module-row-lead">Sunrise</span>
                    <span>{formatClock(daylight.sunrise)}</span>
                </li>
                <li className="module-row">
                    <span className="module-row-lead">Sunset</span>
                    <span>{formatClock(daylight.sunset)}</span>
                </li>
                <li className="module-row">
                    <span className="module-row-lead">Last light</span>
                    <span>{formatClock(daylight.lastLight)}</span>
                    <span className="module-row-trail">civil dusk</span>
                </li>
            </ul>

            <h4 className="module-subhead">Next days</h4>
            <ul className="module-list">
                {weather.daily.slice(0, 5).map((day) => {
                    const dayInfo = describeWeatherCode(day.code);
                    return (
                        <li key={day.date} className="module-day">
                            <span className="module-row-lead">{formatWeekday(day.date)}</span>
                            <span className="module-day-sky">{dayInfo.emoji} {dayInfo.label}</span>
                            <span className="module-row-trail">{Math.round(day.max)}° / {Math.round(day.min)}°</span>
                            <span className="module-day-detail">
                                ☂️ {day.rainChance}%{" · "}💨 {Math.round(day.windMax)} km/h
                                {" · "}🌅 {formatClock(day.sunrise)}{" · "}🌇 {formatClock(day.sunset)}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/** The cut a recipe is built on, for the card's second line. */
function leadIngredients(recipe: Recipe): string {
    return recipe.ingredients.slice(0, 4).map((item) => item.name).join(" · ");
}

/** A recipe as the reader shows it: method in full, every ingredient. */
function recipeStory(recipe: Recipe): StoryDetail {
    return {
        title: recipe.name,
        subtitle: `${recipe.category} · ${recipe.area}`,
        image: recipe.thumbnail,
        body: recipe.instructions,
        facts: recipe.ingredients.map((item) => ({
            label: item.name,
            value: item.measure || "to taste",
        })),
        url: recipe.sourceUrl,
        sourceLabel: "Open the original recipe",
    };
}

export function MealsModule({ mode, context }: ModuleViewProps) {
    const { data, error, loading } = useAsyncData("meals", () => fetchProteinRecipes(5));
    const saved = useSavedRecipes();

    if (loading) return <Loading mode={mode} />;
    if (error || !data || data.length === 0) return <Failed mode={mode} />;
    if (mode === "summary") {
        const kept = saved.length > 0 ? ` · ${saved.length} saved` : "";
        return <>{data[0].name} · {data[0].category}{kept}</>;
    }

    const reading = data.find((recipe) => recipeStoryKey(recipe.id) === context.openStoryId);
    if (reading) {
        const isSaved = saved.some((item) => item.id === reading.id);
        return (
            <StoryReader story={recipeStory(reading)} backLabel="Meals" onBack={() => context.openStory(null)}>
                <button
                    type="button"
                    className={`module-keep${isSaved ? " module-keep-on" : ""}`}
                    aria-pressed={isSaved}
                    onClick={() => toggleSavedRecipe(reading)}
                >
                    {isSaved ? "★ Saved" : "☆ Save this recipe"}
                </button>
            </StoryReader>
        );
    }

    return (
        <div className="module-detail">
            {saved.length > 0 && (
                <>
                    <h4 className="module-subhead">Saved</h4>
                    <ul className="module-list">
                        {saved.map((recipe) => (
                            <li key={recipe.id}>
                                <StoryCard
                                    url={recipe.sourceUrl}
                                    title={recipe.name}
                                    meta={`${recipe.category} · ${recipe.area}`}
                                    image={recipe.thumbnail}
                                    action={(
                                        <button
                                            type="button"
                                            className="module-save module-save-on"
                                            title="Remove from saved"
                                            aria-label={`Remove ${recipe.name} from saved recipes`}
                                            onClick={() => removeSavedRecipe(recipe.id)}
                                        >
                                            ★
                                        </button>
                                    )}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <h4 className="module-subhead">Protein ideas</h4>
            <ul className="module-list">
                {data.map((recipe) => {
                    const isSaved = saved.some((item) => item.id === recipe.id);
                    return (
                        <li key={recipe.id}>
                            <StoryCard
                                title={recipe.name}
                                excerpt={recipe.excerpt}
                                meta={`${recipe.category} · ${recipe.area} · ${leadIngredients(recipe)}`}
                                image={recipe.thumbnail}
                                onOpen={() => context.openStory(recipeStoryKey(recipe.id))}
                                action={(
                                    <button
                                        type="button"
                                        className={`module-save${isSaved ? " module-save-on" : ""}`}
                                        title={isSaved ? "Remove from saved" : "Save this recipe"}
                                        aria-label={`${isSaved ? "Remove" : "Save"} ${recipe.name}`}
                                        aria-pressed={isSaved}
                                        onClick={() => toggleSavedRecipe(recipe)}
                                    >
                                        {isSaved ? "★" : "☆"}
                                    </button>
                                )}
                            />
                        </li>
                    );
                })}
            </ul>

            <p className="module-note">
                Chicken, beef, seafood, lamb, pork and goat only. TheMealDB
                publishes no nutrition figures, so none are shown — the
                ingredients are the honest version of that.
            </p>
        </div>
    );
}
