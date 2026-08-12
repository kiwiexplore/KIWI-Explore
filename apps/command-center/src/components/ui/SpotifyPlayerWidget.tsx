import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import type { SpotifyState } from "../../state/spotify";
import "./SpotifyPlayerWidget.css";

interface SpotifyPlayerWidgetProps {
    spotify: SpotifyState;
}

/**
 * Self-contained (owns its own open/close popover state) so it drops
 * into either TopBar or LaboratoryTopBar with just `spotify` — no
 * anchor plumbing through the parent scene like DetailDrawer needs,
 * since both top bars already have plenty of that. Controls whatever
 * is currently playing on the user's Spotify account (see
 * state/spotify.ts and lib/spotifyApi.ts for why), not audio streamed
 * by this app itself.
 */
export default function SpotifyPlayerWidget({ spotify }: SpotifyPlayerWidgetProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    return (
        <div className="spotify-widget" ref={rootRef}>
            {spotify.connected && spotify.track ? (
                <button type="button" className="spotify-widget-trigger spotify-widget-trigger-active" onClick={() => setOpen((o) => !o)}>
                    {spotify.track.albumArt ? (
                        <img className="spotify-widget-art" src={spotify.track.albumArt} alt="" />
                    ) : (
                        <Music2 size={14} strokeWidth={1.75} />
                    )}
                    <span className="spotify-widget-track-name">{spotify.track.trackName}</span>
                </button>
            ) : (
                <button type="button" className="spotify-widget-trigger" onClick={() => setOpen((o) => !o)} aria-label="Spotify">
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
                                Play/pause and skip whatever's already playing on your Spotify — right from KIWI.
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
