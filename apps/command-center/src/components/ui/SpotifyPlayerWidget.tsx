import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, Search, SkipBack, SkipForward, X } from "lucide-react";
import type { SpotifyState } from "../../state/spotify";
import type { TrackResult } from "../../lib/spotifyApi";
import "./SpotifyPlayerWidget.css";

// How long to wait after typing stops before hitting Spotify's search
// API — avoids firing a request per keystroke.
const SEARCH_DEBOUNCE_MS = 350;

interface SpotifyPlayerWidgetProps {
    spotify: SpotifyState;
}

/**
 * Self-contained (owns its own open/close popover state) so it drops
 * into either TopBar or LaboratoryTopBar with just `spotify` — no
 * anchor plumbing through the parent scene like DetailDrawer needs,
 * since both top bars already have plenty of that. Search always
 * plays results on KIWI's own in-browser Spotify device (Premium
 * required — see state/spotify.ts), never on whatever else happens to
 * be active; the transport controls, by contrast, control whatever's
 * currently playing on the account (KIWI or otherwise).
 */
export default function SpotifyPlayerWidget({ spotify }: SpotifyPlayerWidgetProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<TrackResult[]>([]);
    const [searching, setSearching] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (!value.trim()) { setResults([]); setSearching(false); }
    };

    // Debounced search-as-you-type against Spotify's catalog.
    useEffect(() => {
        if (!query.trim()) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            setSearching(true);
            spotify.search(query).then((found) => {
                if (!cancelled) { setResults(found); setSearching(false); }
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => { cancelled = true; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const handlePlayResult = (track: TrackResult) => {
        // Must run synchronously in this click handler, before playTrack's
        // async work — see SpotifyState.activatePlayer's doc comment.
        spotify.activatePlayer();
        spotify.playTrack(track.uri);
        setQuery("");
        setResults([]);
    };

    const handleToggleOpen = () => {
        spotify.activatePlayer();
        setOpen((o) => !o);
    };

    return (
        <div className="spotify-widget" ref={rootRef}>
            {spotify.connected && spotify.track ? (
                <button type="button" className="spotify-widget-trigger spotify-widget-trigger-active" onClick={handleToggleOpen}>
                    {spotify.track.albumArt ? (
                        <img className="spotify-widget-art" src={spotify.track.albumArt} alt="" />
                    ) : (
                        <Music2 size={14} strokeWidth={1.75} />
                    )}
                    <span className="spotify-widget-track-name">{spotify.track.trackName}</span>
                </button>
            ) : (
                <button type="button" className="spotify-widget-trigger" onClick={handleToggleOpen} aria-label="Spotify">
                    <Music2 size={16} strokeWidth={1.75} />
                    <span className="spotify-widget-tooltip">Spotify</span>
                </button>
            )}

            {open && (
                <div className="spotify-widget-popover">
                    <div className="spotify-widget-popover-header">
                        <span>Spotify</span>
                        <button type="button" className="spotify-widget-popover-close" onClick={() => setOpen(false)} aria-label="Close">
                            <X size={14} strokeWidth={2} />
                        </button>
                    </div>

                    {spotify.connected ? (
                        <div className="spotify-widget-connected">
                            <div className="spotify-widget-search">
                                <Search size={14} strokeWidth={1.75} className="spotify-widget-search-icon" />
                                <input
                                    type="text"
                                    className="spotify-widget-search-input"
                                    placeholder="Search Spotify…"
                                    value={query}
                                    onChange={(e) => handleQueryChange(e.target.value)}
                                />
                            </div>

                            {query.trim() && (
                                <div className="spotify-widget-results">
                                    {searching ? (
                                        <p className="spotify-widget-empty">Searching…</p>
                                    ) : results.length ? (
                                        results.map((r) => (
                                            <button
                                                type="button"
                                                key={r.uri}
                                                className="spotify-widget-result"
                                                onClick={() => handlePlayResult(r)}
                                            >
                                                {r.albumArt ? (
                                                    <img className="spotify-widget-result-art" src={r.albumArt} alt="" />
                                                ) : (
                                                    <Music2 size={14} strokeWidth={1.75} />
                                                )}
                                                <span className="spotify-widget-result-text">
                                                    <span className="spotify-widget-result-name">{r.name}</span>
                                                    <span className="spotify-widget-result-artist">{r.artistName}</span>
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="spotify-widget-empty">No results.</p>
                                    )}
                                </div>
                            )}

                            {!spotify.playerReady && (
                                <p className="spotify-widget-hint">
                                    {spotify.playerError ?? "Connecting KIWI as a Spotify device…"}
                                </p>
                            )}

                            {spotify.playError && <p className="spotify-widget-error">{spotify.playError}</p>}

                            {spotify.track ? (
                                <div className="spotify-widget-now-playing">
                                    {spotify.track.albumArt && <img className="spotify-widget-now-playing-art" src={spotify.track.albumArt} alt="" />}
                                    <div className="spotify-widget-now-playing-text">
                                        <div className="spotify-widget-now-playing-name">{spotify.track.trackName}</div>
                                        <div className="spotify-widget-now-playing-artist">{spotify.track.artistName}</div>
                                        {spotify.track.deviceName && (
                                            <div className="spotify-widget-now-playing-device">Playing on {spotify.track.deviceName}</div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="spotify-widget-empty">
                                    {spotify.error ?? "Nothing playing — open Spotify somewhere and start a track."}
                                </p>
                            )}

                            <div className="spotify-widget-controls">
                                <button type="button" className="spotify-widget-control-btn" onClick={spotify.previous} aria-label="Previous">
                                    <SkipBack size={16} strokeWidth={1.75} />
                                </button>
                                <button type="button" className="spotify-widget-control-btn spotify-widget-control-btn-main" onClick={spotify.togglePlay} aria-label="Play/Pause">
                                    {spotify.track?.isPlaying ? <Pause size={18} strokeWidth={1.75} /> : <Play size={18} strokeWidth={1.75} />}
                                </button>
                                <button type="button" className="spotify-widget-control-btn" onClick={spotify.next} aria-label="Next">
                                    <SkipForward size={16} strokeWidth={1.75} />
                                </button>
                            </div>

                            <button type="button" className="spotify-widget-disconnect" onClick={spotify.disconnect}>
                                Disconnect
                            </button>
                        </div>
                    ) : spotify.configured ? (
                        <div className="spotify-widget-connect">
                            <p className="spotify-widget-connect-copy">
                                Search and play music right from KIWI — independent of your phone with Spotify Premium.
                            </p>
                            {spotify.error && <p className="spotify-widget-error">{spotify.error}</p>}
                            <button type="button" className="spotify-widget-connect-btn" onClick={spotify.connect} disabled={spotify.connecting}>
                                {spotify.connecting ? "Connecting…" : "Connect Spotify"}
                            </button>
                        </div>
                    ) : (
                        <div className="spotify-widget-connect">
                            <p className="spotify-widget-connect-copy">
                                Spotify isn't set up for this deployment yet — add VITE_SPOTIFY_CLIENT_ID (redirect URI: <code>{spotify.redirectUri}</code>).
                            </p>
                            <a
                                className="spotify-widget-dev-link"
                                href="https://developer.spotify.com/dashboard"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Create a Spotify Developer app →
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
