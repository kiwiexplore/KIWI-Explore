import { useEffect, useState } from "react";
import type { ModuleViewProps } from "./types";

/**
 * What KIWI is actually running on, and what it can currently reach.
 *
 * Every number here is measured, not decorated: the browser knows its
 * own connection, storage and battery, and KIWI's feed service either
 * answers or it doesn't. That last one is the useful part day to day —
 * two of the Liberec sources come through that service (see
 * lib/liberecNews.ts), so "is it up" is the difference between four
 * news sources and two.
 *
 * The APIs behind this are unevenly supported, and the module says so
 * rather than inventing a plausible figure: Battery Status is
 * Chrome-only, Network Information is Chrome and Android, and Firefox
 * and Safari have neither. Anything missing simply isn't listed.
 */

interface Reading {
    label: string;
    value: string;
}

interface NetworkInformation {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
}

interface BatteryStatus {
    level: number;
    charging: boolean;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
    return `${Math.round(bytes / 1024)} kB`;
}

export function SystemsModule({ mode }: ModuleViewProps) {
    const [online, setOnline] = useState(() => navigator.onLine);
    const [service, setService] = useState<"checking" | "up" | "down">("checking");
    const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
    const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

    // Connection state is an event, not a poll — the browser tells us.
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => {
            window.removeEventListener("online", update);
            window.removeEventListener("offline", update);
        };
    }, []);

    // Is the feed service answering? Its /api/health endpoint exists for
    // exactly this — a cheap yes/no that touches none of the sources.
    useEffect(() => {
        let cancelled = false;
        const base = import.meta.env.VITE_FEED_SERVICE ?? "";
        fetch(`${base}/api/health`)
            .then((res) => { if (!cancelled) setService(res.ok ? "up" : "down"); })
            .catch(() => { if (!cancelled) setService("down"); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const getBattery = (navigator as Navigator & {
            getBattery?: () => Promise<BatteryStatus>;
        }).getBattery;
        if (!getBattery) return;

        let status: BatteryStatus | null = null;
        let cancelled = false;
        const read = () => {
            if (status && !cancelled) setBattery({ level: status.level, charging: status.charging });
        };

        getBattery.call(navigator).then((result) => {
            if (cancelled) return;
            status = result;
            read();
            status.addEventListener("levelchange", read);
            status.addEventListener("chargingchange", read);
        }).catch(() => { /* Refused or unsupported — the row just isn't shown. */ });

        return () => {
            cancelled = true;
            status?.removeEventListener("levelchange", read);
            status?.removeEventListener("chargingchange", read);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        navigator.storage?.estimate?.().then((estimate) => {
            if (cancelled || !estimate.usage || !estimate.quota) return;
            setStorage({ usage: estimate.usage, quota: estimate.quota });
        }).catch(() => { /* Same: unsupported means unlisted. */ });
        return () => { cancelled = true; };
    }, []);

    if (mode === "summary") {
        return <>{online ? "Online" : "Offline"} · feeds {service === "up" ? "live" : service === "down" ? "offline" : "…"}</>;
    }

    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    const cores = navigator.hardwareConcurrency;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

    const readings: Reading[] = [
        { label: "Network", value: online ? "Connected" : "Offline" },
    ];
    if (connection?.effectiveType) readings.push({ label: "Link", value: connection.effectiveType.toUpperCase() });
    if (connection?.downlink) readings.push({ label: "Downlink", value: `${connection.downlink} Mb/s` });
    if (connection?.rtt !== undefined) readings.push({ label: "Latency", value: `${connection.rtt} ms` });
    if (battery) {
        readings.push({
            label: "Battery",
            value: `${Math.round(battery.level * 100)}%${battery.charging ? " · charging" : ""}`,
        });
    }
    if (cores) readings.push({ label: "Cores", value: String(cores) });
    if (memory) readings.push({ label: "Memory", value: `${memory} GB` });
    if (storage) {
        readings.push({
            label: "Storage",
            value: `${formatBytes(storage.usage)} of ${formatBytes(storage.quota)}`,
        });
    }
    readings.push({ label: "Display", value: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x` });

    return (
        <div className="module-detail">
            <h4 className="module-subhead">KIWI's own services</h4>
            <ul className="module-list">
                <li className="module-row">
                    <span className="module-row-lead">Feeds</span>
                    <span>
                        {service === "checking" ? "Checking…"
                            : service === "up" ? "Feed service answering"
                                : "Feed service unreachable"}
                    </span>
                    <span className={`module-row-trail ${service === "up" ? "module-up" : service === "down" ? "module-down" : ""}`}>
                        {service === "up" ? "▲ up" : service === "down" ? "▼ down" : "…"}
                    </span>
                </li>
            </ul>
            {service === "down" && (
                <p className="module-note">
                    Liberecký deník and Liberecká drbna come through that
                    service — without it the news module falls back to the
                    two sources the browser can read on its own.
                </p>
            )}

            <h4 className="module-subhead">This device</h4>
            <ul className="module-list">
                {readings.map((reading) => (
                    <li key={reading.label} className="module-row">
                        <span className="module-row-lead">{reading.label}</span>
                        <span>{reading.value}</span>
                    </li>
                ))}
            </ul>

            <p className="module-note">
                Battery and link quality are only published by some
                browsers — anything this one keeps to itself is left out
                rather than guessed at.
            </p>
        </div>
    );
}
