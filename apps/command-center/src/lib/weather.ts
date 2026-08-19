// Live weather data via Open-Meteo (https://open-meteo.com/) — free,
// no API key required, CORS-enabled for direct browser fetches. This is
// the first widget wired up to a real external data source (everything
// else in this scene is still a placeholder) — see WeatherWidget.

export interface WeatherLocation {
    latitude: number;
    longitude: number;
    label: string;
}

export interface DailyForecast {
    date: string;
    code: number;
    max: number;
    min: number;
    /** Chance of any precipitation at all, as a percentage. */
    rainChance: number;
    /** How much, in mm, if it does. */
    rainTotal: number;
    windMax: number;
    uvMax: number;
    sunrise: string;
    sunset: string;
}

/** One hour of the near forecast — the shape of the day ahead. */
export interface HourlyForecast {
    time: string;
    temperature: number;
    code: number;
    rainChance: number;
    windSpeed: number;
    /** False overnight, which is what shades the night hours. */
    isDay: boolean;
}

export interface WeatherData {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    code: number;
    /** Where the wind is coming FROM, in degrees. */
    windDirection: number;
    windGusts: number;
    /** mm in the last hour. */
    precipitation: number;
    cloudCover: number;
    pressure: number;
    isDay: boolean;
    /** From now on, hour by hour — see fetchWeather. */
    hourly: HourlyForecast[];
    daily: DailyForecast[];
}

/** Wind direction as a compass point, which is how anyone reads it. */
export function describeWindDirection(degrees: number): string {
    const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return points[Math.round(degrees / 45) % 8];
}

/**
 * The UV index in the words people actually act on. The bands are the
 * WHO's own (1-2 low, 3-5 moderate, 6-7 high, 8-10 very high, 11+
 * extreme), not a scale invented here.
 */
export function describeUvIndex(uv: number): string {
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very high";
    return "Extreme";
}

// Darfield, New Zealand — used only if the browser can't/won't provide a
// real location (geolocation denied, unsupported, or timed out).
export const FALLBACK_LOCATION: WeatherLocation = {
    latitude: -43.4833,
    longitude: 172.1167,
    label: "Darfield, New Zealand",
};

const WEATHER_CODES: Record<number, { emoji: string; label: string }> = {
    0: { emoji: "☀️", label: "Clear sky" },
    1: { emoji: "🌤️", label: "Mainly clear" },
    2: { emoji: "⛅", label: "Partly cloudy" },
    3: { emoji: "☁️", label: "Overcast" },
    45: { emoji: "🌫️", label: "Fog" },
    48: { emoji: "🌫️", label: "Rime fog" },
    51: { emoji: "🌦️", label: "Light drizzle" },
    53: { emoji: "🌦️", label: "Moderate drizzle" },
    55: { emoji: "🌧️", label: "Dense drizzle" },
    56: { emoji: "🌧️", label: "Light freezing drizzle" },
    57: { emoji: "🌧️", label: "Dense freezing drizzle" },
    61: { emoji: "🌧️", label: "Slight rain" },
    63: { emoji: "🌧️", label: "Moderate rain" },
    65: { emoji: "🌧️", label: "Heavy rain" },
    66: { emoji: "🌧️", label: "Light freezing rain" },
    67: { emoji: "🌧️", label: "Heavy freezing rain" },
    71: { emoji: "🌨️", label: "Slight snow" },
    73: { emoji: "🌨️", label: "Moderate snow" },
    75: { emoji: "❄️", label: "Heavy snow" },
    77: { emoji: "❄️", label: "Snow grains" },
    80: { emoji: "🌦️", label: "Slight rain showers" },
    81: { emoji: "🌧️", label: "Moderate rain showers" },
    82: { emoji: "⛈️", label: "Violent rain showers" },
    85: { emoji: "🌨️", label: "Slight snow showers" },
    86: { emoji: "❄️", label: "Heavy snow showers" },
    95: { emoji: "⛈️", label: "Thunderstorm" },
    96: { emoji: "⛈️", label: "Thunderstorm, slight hail" },
    99: { emoji: "⛈️", label: "Thunderstorm, heavy hail" },
};

export function describeWeatherCode(code: number): { emoji: string; label: string } {
    return WEATHER_CODES[code] ?? { emoji: "🌡️", label: "Unknown" };
}

// Wraps navigator.geolocation in a Promise with a short timeout — the
// browser prompt can sit unanswered indefinitely otherwise, which would
// leave the widget stuck "loading" instead of falling back.
export function getBrowserLocation(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
        if (!("geolocation" in navigator)) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 6000, maximumAge: 10 * 60 * 1000 },
        );
    });
}

// Reverse geocoding via BigDataCloud's free client-side endpoint — no
// API key, CORS-enabled, exactly what's needed here (coordinates -> a
// human-readable place name for display).
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
        const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        const city = data.city || data.locality || data.principalSubdivision;
        const country = data.countryName;
        if (city && country) return `${city}, ${country}`;
        return country ?? null;
    } catch {
        return null;
    }
}

export async function resolveLocation(): Promise<WeatherLocation> {
    const coords = await getBrowserLocation();
    if (!coords) return FALLBACK_LOCATION;
    const label = await reverseGeocode(coords.latitude, coords.longitude);
    return { ...coords, label: label ?? `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}` };
}

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherData> {
    const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
        `,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,surface_pressure,is_day` +
        `&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,is_day` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset` +
        `&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
    const data = await res.json();

    const daily: DailyForecast[] = (data.daily?.time ?? []).map((date: string, i: number) => ({
        date,
        code: data.daily.weather_code[i],
        max: data.daily.temperature_2m_max[i],
        min: data.daily.temperature_2m_min[i],
        rainChance: data.daily.precipitation_probability_max?.[i] ?? 0,
        rainTotal: data.daily.precipitation_sum?.[i] ?? 0,
        windMax: data.daily.wind_speed_10m_max?.[i] ?? 0,
        uvMax: data.daily.uv_index_max?.[i] ?? 0,
        sunrise: data.daily.sunrise?.[i] ?? "",
        sunset: data.daily.sunset?.[i] ?? "",
    }));

    // The hourly series starts at midnight local time, so most of it is
    // already in the past by the time anyone looks. Only what's still
    // ahead is of any use — found by the hour Open-Meteo itself says is
    // current, rather than by comparing the browser's clock against
    // timestamps in a timezone that may not be its own.
    const times: string[] = data.hourly?.time ?? [];
    const currentHour = (data.current?.time ?? "").slice(0, 13);
    const from = Math.max(0, times.findIndex((time) => time.slice(0, 13) >= currentHour));
    const hourly: HourlyForecast[] = times.slice(from, from + 24).map((time, offset) => {
        const i = from + offset;
        return {
            time,
            temperature: data.hourly.temperature_2m[i],
            code: data.hourly.weather_code[i],
            rainChance: data.hourly.precipitation_probability?.[i] ?? 0,
            windSpeed: data.hourly.wind_speed_10m?.[i] ?? 0,
            isDay: (data.hourly.is_day?.[i] ?? 1) === 1,
        };
    });

    return {
        temperature: data.current.temperature_2m,
        feelsLike: data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
        code: data.current.weather_code,
        windDirection: data.current.wind_direction_10m ?? 0,
        windGusts: data.current.wind_gusts_10m ?? 0,
        precipitation: data.current.precipitation ?? 0,
        cloudCover: data.current.cloud_cover ?? 0,
        pressure: data.current.surface_pressure ?? 0,
        isDay: (data.current.is_day ?? 1) === 1,
        hourly,
        daily,
    };
}
