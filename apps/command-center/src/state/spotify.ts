import { useEffect, useRef, useState } from "react";
import {
    buildAuthorizeUrl, exchangeCodeForTokens, generateCodeVerifier, generateState, getRedirectUri,
    refreshAccessToken, type SpotifyTokens,
} from "../lib/spotifyAuth";
import {
    fetchCurrentPlayback, listDevices, nextTrack, pause, play, previousTrack, searchTracks, startTrack, transferPlayback,
    NoActiveDeviceError, type CurrentPlayback, type TrackResult,
} from "../lib/spotifyApi";
import { createSpotifyPlayer } from "../lib/spotifyPlaybackSdk";

// One app-wide Client ID, set once by whoever runs this deployment
// (apps/command-center/.env: VITE_SPOTIFY_CLIENT_ID=...), not
// something each visitor enters — the Client ID identifies the KIWI
// app itself, not the person connecting. Every visitor still
// authorizes with their own Spotify account; only the app registration
// is shared. Safe to ship in client-side code: PKCE apps have no
// client secret, the Client ID alone can't act on anyone's behalf.
const CONFIGURED_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";
const TOKENS_KEY = "kiwi_spotify_tokens";
const VERIFIER_KEY = "kiwi_spotify_pkce_verifier";
const STATE_KEY = "kiwi_spotify_pkce_state";
const POLL_INTERVAL_MS = 5000;

function loadTokens(): SpotifyTokens | null {
    try {
        const raw = localStorage.getItem(TOKENS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveTokens(tokens: SpotifyTokens | null) {
    if (tokens) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(TOKENS_KEY);
}

export interface SpotifyState {
    // Whether a Client ID is configured at all — the widget uses this
    // to tell "not set up yet" (a deployment/config issue) apart from
    // "set up but not connected" (the normal signed-out state).
    configured: boolean;
    redirectUri: string;
    connected: boolean;
    connecting: boolean;
    error: string | null;
    track: CurrentPlayback | null;
    connect: () => void;
    disconnect: () => void;
    togglePlay: () => void;
    next: () => void;
    previous: () => void;
    // In-browser playback (Web Playback SDK — see lib/spotifyPlaybackSdk.ts).
    // playerReady means KIWI has registered as a Spotify Connect device and
    // playTrack() will play here rather than wherever else is active.
    playerReady: boolean;
    playerError: string | null;
    // Why the most recent playTrack() call failed, if it did. Distinct
    // from `error` (which the background poll clears every few seconds)
    // so this actually stays visible.
    playError: string | null;
    search: (query: string) => Promise<TrackResult[]>;
    playTrack: (uri: string) => void;
    // Call synchronously from inside a click handler (not after an
    // await) before playTrack() — unlocks audio in browsers with strict
    // autoplay policies. See spotify-sdk.d.ts's activateElement doc.
    activatePlayer: () => void;
}

/**
 * Spotify connection — owned by App.tsx (same lift-to-App.tsx pattern
 * as account/calendar/laboratoryData) so both TopBar and
 * LaboratoryTopBar share one connection. Unlike the rest of this
 * app's state, tokens and the pending PKCE verifier genuinely need
 * localStorage, not just in-memory React state: connecting means a
 * full-page redirect to accounts.spotify.com and back, which would
 * otherwise wipe everything. Needs one Spotify Developer app set up
 * for this deployment (see CONFIGURED_CLIENT_ID above) and each
 * visitor's own Spotify Premium to play music inside KIWI itself
 * (rather than only remote-controlling a phone/desktop app) — see
 * lib/spotifyPlaybackSdk.ts for the in-browser device this sets up.
 */
export function useSpotifyState(): SpotifyState {
    const clientId = CONFIGURED_CLIENT_ID;
    const [tokens, setTokens] = useState<SpotifyTokens | null>(() => loadTokens());
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [track, setTrack] = useState<CurrentPlayback | null>(null);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [playerError, setPlayerError] = useState<string | null>(null);
    // Separate from `error`: the 5s background poll below clears `error`
    // on every successful check, which was silently wiping out playTrack()
    // failures within seconds of them happening. This one only changes on
    // an explicit play attempt, so a real failure reason actually sticks.
    const [playError, setPlayError] = useState<string | null>(null);
    const tokensRef = useRef(tokens);
    const deviceIdRef = useRef<string | null>(null);
    const playerRef = useRef<Spotify.Player | null>(null);
    useEffect(() => { tokensRef.current = tokens; }, [tokens]);
    useEffect(() => { deviceIdRef.current = deviceId; }, [deviceId]);

    const applyTokens = (next: SpotifyTokens) => {
        setTokens(next);
        saveTokens(next);
    };

    const disconnect = () => {
        setTokens(null);
        saveTokens(null);
        setTrack(null);
        playerRef.current?.disconnect();
        playerRef.current = null;
        setDeviceId(null);
        setPlayerError(null);
        setPlayError(null);
    };

    // Ensures a non-expired access token, refreshing if needed —
    // called before every API request rather than on a timer, so it
    // only ever does work when the widget is actually being used.
    const ensureFreshToken = async (): Promise<string | null> => {
        const current = tokensRef.current;
        if (!current) return null;
        if (Date.now() < current.expiresAt - 30_000) return current.accessToken;
        try {
            const refreshed = await refreshAccessToken(clientId, current.refreshToken);
            const merged: SpotifyTokens = { ...refreshed, refreshToken: refreshed.refreshToken || current.refreshToken };
            applyTokens(merged);
            return merged.accessToken;
        } catch {
            disconnect();
            setError("Spotify session expired — reconnect.");
            return null;
        }
    };

    // Handle the redirect back from Spotify (?code=&state=) once on
    // mount, then scrub those params from the URL so a refresh doesn't
    // try to redeem the same code twice.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const returnedState = params.get("state");
        if (!code) return;

        const expectedState = sessionStorage.getItem(STATE_KEY);
        const verifier = sessionStorage.getItem(VERIFIER_KEY);
        window.history.replaceState({}, "", window.location.pathname);

        Promise.resolve()
            .then(() => {
                setConnecting(true);
                if (!verifier || !returnedState || returnedState !== expectedState) {
                    throw new Error("Spotify sign-in didn't complete — try connecting again.");
                }
                return exchangeCodeForTokens(clientId, code, verifier);
            })
            .then((newTokens) => {
                applyTokens(newTokens);
                sessionStorage.removeItem(VERIFIER_KEY);
                sessionStorage.removeItem(STATE_KEY);
            })
            .catch((e) => setError(e instanceof Error ? e.message : "Could not connect to Spotify."))
            .finally(() => setConnecting(false));
        // Only ever run once, right after the redirect lands.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Refreshes `track` from whatever's currently playing on the
    // account. Shared by the polling effect below and by playTrack(),
    // which calls it right after issuing a play command so the UI
    // doesn't wait out a full poll interval to reflect it.
    const refreshTrack = async () => {
        const token = await ensureFreshToken();
        if (!token) return;
        try {
            const playback = await fetchCurrentPlayback(token);
            setTrack(playback);
            setError(null);
        } catch (e) {
            if (e instanceof NoActiveDeviceError) { setTrack(null); setError(e.message); }
            else setError(e instanceof Error ? e.message : "Could not reach Spotify.");
        }
    };

    // Poll current playback while connected.
    useEffect(() => {
        if (!tokens) return;
        let cancelled = false;
        const tick = () => { if (!cancelled) refreshTrack(); };
        tick();
        const interval = setInterval(tick, POLL_INTERVAL_MS);
        return () => { cancelled = true; clearInterval(interval); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens]);

    // Bring up KIWI's own Spotify Connect device (Web Playback SDK) so
    // playTrack() can play here instead of on whatever device was last
    // active. Keyed on connected/disconnected only (not on `tokens`
    // itself, which changes identity on every hourly refresh) — tearing
    // the device down on every token refresh would drop playback mid-song.
    useEffect(() => {
        if (!tokens) return;
        let cancelled = false;

        createSpotifyPlayer({
            getOAuthToken: (callback) => { ensureFreshToken().then((token) => { if (token) callback(token); }); },
            onDeviceReady: (id) => { if (!cancelled) setDeviceId(id); },
            onDeviceOffline: () => { if (!cancelled) setDeviceId(null); },
            onError: (message) => { if (!cancelled) setPlayerError(message); },
        })
            .then((player) => {
                if (cancelled) { player.disconnect(); return; }
                playerRef.current = player;
            })
            .catch((e) => {
                if (!cancelled) setPlayerError(e instanceof Error ? e.message : "Could not start KIWI's Spotify player.");
            });

        return () => {
            cancelled = true;
            playerRef.current?.disconnect();
            playerRef.current = null;
            setDeviceId(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [Boolean(tokens)]);

    const connect = () => {
        if (!clientId) {
            setError("Spotify isn't configured for this deployment yet.");
            return;
        }
        setError(null);
        const verifier = generateCodeVerifier();
        const state = generateState();
        sessionStorage.setItem(VERIFIER_KEY, verifier);
        sessionStorage.setItem(STATE_KEY, state);
        buildAuthorizeUrl(clientId, verifier, state).then((url) => { window.location.href = url; });
    };

    const withToken = (action: (token: string) => Promise<unknown>) => {
        ensureFreshToken().then((token) => {
            if (!token) return;
            action(token).catch((e) => setError(e instanceof Error ? e.message : "Spotify action failed."));
        });
    };

    const togglePlay = () => withToken((token) => (track?.isPlaying ? pause(token) : play(token)));
    const next = () => withToken((token) => nextTrack(token));
    const previous = () => withToken((token) => previousTrack(token));

    const search = async (query: string): Promise<TrackResult[]> => {
        const token = await ensureFreshToken();
        if (!token) return [];
        return searchTracks(token, query);
    };

    // Polls deviceIdRef rather than waiting on a single readiness event,
    // since playTrack() can be called before KIWI's device has finished
    // registering (e.g. right after connecting) and should wait it out
    // instead of giving up.
    const waitForDevice = async (timeoutMs = 6000): Promise<string | null> => {
        const start = Date.now();
        while (!deviceIdRef.current) {
            if (Date.now() - start > timeoutMs) return null;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return deviceIdRef.current;
    };

    // Always plays on KIWI's own in-browser device — never falls back to
    // whatever device happened to be active (e.g. the phone), since that
    // defeats the point of playing independently of it. Uses playError
    // (not the shared `error`) so the reason survives the next poll tick —
    // see playError's own comment above.
    const playTrack = (uri: string) => {
        setPlayError(null);
        (async () => {
            const token = await ensureFreshToken();
            if (!token) { setPlayError("Not connected to Spotify — reconnect and try again."); return; }
            const id = await waitForDevice();
            if (!id) {
                setPlayError(playerError ?? "KIWI's Spotify player isn't ready yet — try again in a moment.");
                return;
            }
            // Spotify can 404 a play call aimed at a device that only just
            // registered, before its backend has caught up with the SDK's
            // "ready" event — retry that specific failure a few times
            // rather than surfacing it as a hard error immediately.
            const retryDelaysMs = [0, 400, 900, 1600];
            for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
                if (retryDelaysMs[attempt]) await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
                try {
                    await transferPlayback(token, id);
                    // Give the forced transfer a moment to actually land
                    // before targeting the same device with a specific track.
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    await startTrack(token, uri, id);
                    await refreshTrack();
                    return;
                } catch (e) {
                    const isLastAttempt = attempt === retryDelaysMs.length - 1;
                    if (!(e instanceof NoActiveDeviceError) || isLastAttempt) {
                        if (e instanceof NoActiveDeviceError) {
                            // Diagnostic: ask Spotify what it actually sees,
                            // with explicit ids so a "same name, different
                            // id" mismatch is impossible to miss.
                            const devices = await listDevices(token).catch(() => null);
                            const seen = devices === null
                                ? "(couldn't check)"
                                : devices.length === 0
                                    ? "none"
                                    : devices.map((d) => `${d.name} [${d.id}]${d.id === id ? " ← matches" : ""}`).join(", ");
                            setPlayError(`${e.message} KIWI is using id [${id}]. Spotify's device list: ${seen}.`);
                        } else {
                            setPlayError(e instanceof Error ? e.message : "Could not play that track.");
                        }
                        return;
                    }
                }
            }
        })();
    };

    const activatePlayer = () => {
        playerRef.current?.activateElement?.();
    };

    return {
        configured: Boolean(clientId),
        redirectUri: getRedirectUri(),
        connected: Boolean(tokens),
        connecting, error, track,
        connect, disconnect, togglePlay, next, previous,
        playerReady: Boolean(deviceId),
        playerError,
        playError,
        search, playTrack, activatePlayer,
    };
}
