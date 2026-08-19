// Sunrise, sunset and twilight for a given spot, via
// sunrise-sunset.org's free, keyless, CORS-enabled API.
//
// This is the half of "when do I go out" that a weather forecast can't
// answer: how much daylight is actually left, and when the light goes.
// Paired with the forecast it's the difference between "it'll be fine
// tomorrow" and "you have four hours from nine".

export interface Daylight {
    sunrise: Date;
    sunset: Date;
    /** Civil twilight — usable light before sunrise and after sunset. */
    firstLight: Date;
    lastLight: Date;
    /** Seconds between sunrise and sunset. */
    dayLengthSeconds: number;
}

export async function fetchDaylight(latitude: number, longitude: number, date = "today"): Promise<Daylight> {
    const res = await fetch(
        `https://api.sunrise-sunset.org/json?lat=${latitude}&lng=${longitude}&date=${date}&formatted=0`,
    );
    if (!res.ok) throw new Error(`Sunrise-sunset request failed: ${res.status}`);

    const data = await res.json() as {
        status: string;
        results: {
            sunrise: string; sunset: string;
            civil_twilight_begin: string; civil_twilight_end: string;
            day_length: number;
        };
    };
    if (data.status !== "OK") throw new Error(`Sunrise-sunset returned ${data.status}`);

    return {
        sunrise: new Date(data.results.sunrise),
        sunset: new Date(data.results.sunset),
        firstLight: new Date(data.results.civil_twilight_begin),
        lastLight: new Date(data.results.civil_twilight_end),
        dayLengthSeconds: data.results.day_length,
    };
}

/** How much daylight is left from now, in whole minutes (0 once dark). */
export function daylightRemaining(daylight: Daylight, now = new Date()): number {
    return Math.max(0, Math.round((daylight.sunset.getTime() - now.getTime()) / 60000));
}
