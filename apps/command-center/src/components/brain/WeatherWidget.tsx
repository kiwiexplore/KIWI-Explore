import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Panel from "../ui/Panel";
import {
    describeWeatherCode, fetchWeather, resolveLocation,
    type WeatherData, type WeatherLocation,
} from "../../lib/weather";
import "./WeatherWidget.css";

interface WeatherWidgetProps {
    onOpenDetail: (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => void;
}

function WeatherDetail({ location, weather, error }: { location: WeatherLocation | null; weather: WeatherData | null; error: boolean }) {
    if (error || !weather || !location) {
        return <div className="weather-detail-error">Unable to load weather data right now — check your connection and try again.</div>;
    }
    const info = describeWeatherCode(weather.code);

    return (
        <div className="weather-detail">
            <div className="weather-detail-header">
                <span className="weather-detail-emoji">{info.emoji}</span>
                <div>
                    <div className="weather-detail-temp">{Math.round(weather.temperature)}°C</div>
                    <div className="weather-detail-label">{info.label} · feels like {Math.round(weather.feelsLike)}°C</div>
                </div>
            </div>

            <div className="weather-detail-location">📍 {location.label}</div>

            <div className="weather-detail-stats">
                <span>💧 Humidity {weather.humidity}%</span>
                <span>💨 Wind {Math.round(weather.windSpeed)} km/h</span>
            </div>

            <div className="weather-detail-forecast">
                {weather.daily.map((d) => {
                    const dInfo = describeWeatherCode(d.code);
                    const day = new Date(d.date).toLocaleDateString(undefined, { weekday: "short" });
                    return (
                        <div key={d.date} className="weather-detail-forecast-day">
                            <span>{day}</span>
                            <span>{dInfo.emoji}</span>
                            <span>{Math.round(d.max)}° / {Math.round(d.min)}°</span>
                        </div>
                    );
                })}
            </div>

            <div className="weather-detail-links">
                <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Data: Open-Meteo</a>
                <a
                    href={`https://www.google.com/search?q=weather+${encodeURIComponent(location.label)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    More on Google
                </a>
            </div>
        </div>
    );
}

/**
 * The first widget in this scene wired up to real, live data (everything
 * else is still a placeholder — see the multi-tenant product notes on
 * why the backend/data layer is deliberately deferred elsewhere). Uses
 * browser geolocation (falling back to a fixed location if denied/
 * unavailable — see lib/weather's FALLBACK_LOCATION) + Open-Meteo, both
 * free/keyless/CORS-enabled, so this works with no backend at all.
 *
 * Compact view here; clicking opens the same DetailDrawer every other
 * widget uses, with the fuller forecast + source links.
 */
export default function WeatherWidget({ onOpenDetail }: WeatherWidgetProps) {
    const [location, setLocation] = useState<WeatherLocation | null>(null);
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const loc = await resolveLocation();
                if (cancelled) return;
                setLocation(loc);
                const data = await fetchWeather(loc.latitude, loc.longitude);
                if (cancelled) return;
                setWeather(data);
            } catch {
                if (!cancelled) setError(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        onOpenDetail("🌤️ Weather", anchor, <WeatherDetail location={location} weather={weather} error={error} />, 480);
    };

    let body: ReactNode;
    if (error) {
        body = <span className="weather-widget-muted">Unable to load weather.</span>;
    } else if (!weather || !location) {
        body = <span className="weather-widget-muted">Loading…</span>;
    } else {
        const info = describeWeatherCode(weather.code);
        body = (
            <div className="weather-widget-body">
                <div className="weather-widget-main">
                    <span className="weather-widget-emoji">{info.emoji}</span>
                    <span className="weather-widget-temp">{Math.round(weather.temperature)}°C</span>
                </div>
                <div className="weather-widget-label">{info.label}</div>
                <div className="weather-widget-location">{location.label}</div>
            </div>
        );
    }

    return <Panel title="🌤️ Weather" onClick={handleClick}>{body}</Panel>;
}
