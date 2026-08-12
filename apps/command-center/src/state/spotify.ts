import { useEffect, useRef, useState } from "react";
import {
    buildAuthorizeUrl, exchangeCodeForTokens, generateCodeVerifier, generateState, getRedirectUri,
    refreshAccessToken, type SpotifyTokens,
} from "../lib/spotifyAuth";
import { fetchCurrentPlayback, nextTrack, pause, play, previousTrack, NoActiveDeviceError, type CurrentPlayback } from "../lib/spotifyApi";

const CLIENT_ID_KEY = "kiwi_spotify_client_id";
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
    clientId: string;
    setClientId: (id: string) => void;
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
}

/**
 * Spotify connection — owned by App.tsx (same lift-to-App.tsx pattern
 * as account/calendar/laboratoryData) so both TopBar and
 * LaboratoryTopBar share one connection. Unlike the rest of this
 * app's state, tokens and the pending PKCE verifier genuinely need
 * localStorage, not just in-memory React state: connecting means a
 * full-page redirect to accounts.spotify.com and back, which would
 * otherwise wipe everything. Needs the user's own Spotify Developer
 * app (Client ID, with this app's redirect URI registered) and
 * Spotify Premium to actually play anything — this widget controls
 * whatever's already playing on the user's account (phone, desktop
 * app, etc.) via the Web API rather than streaming audio itself (see
 * lib/spotifyApi.ts's own doc comment for why).
 */
export function useSpotifyState(): SpotifyState {
    const [clientId, setClientIdState] = useState(() => localStorage.getItem(CLIENT_ID_KEY) ?? "");
    const [tokens, setTokens] = useState<SpotifyTokens | null>(() => loadTokens());
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [track, setTrack] = useState<CurrentPlayback | null>(null);
    const tokensRef = useRef(tokens);
    useEffect(() => { tokensRef.current = tokens; }, [tokens]);

    const setClientId = (id: string) => {
        setClientIdState(id);
        localStorage.setItem(CLIENT_ID_KEY, id);
    };

    const applyTokens = (next: SpotifyTokens) => {
        setTokens(next);
        saveTokens(next);
    };

    const disconnect = () => {
        setTokens(null);
        saveTokens(null);
        setTrack(null);
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

    // Poll current playback while connected.
    useEffect(() => {
        if (!tokens) return;
        let cancelled = false;

        const tick = async () => {
            const token = await ensureFreshToken();
            if (!token || cancelled) return;
            try {
                const playback = await fetchCurrentPlayback(token);
                if (!cancelled) { setTrack(playback); setError(null); }
            } catch (e) {
                if (cancelled) return;
                if (e instanceof NoActiveDeviceError) { setTrack(null); setError(e.message); }
                else setError(e instanceof Error ? e.message : "Could not reach Spotify.");
            }
        };

        tick();
        const interval = setInterval(tick, POLL_INTERVAL_MS);
        return () => { cancelled = true; clearInterval(interval); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens]);

    const connect = () => {
        if (!clientId.trim()) {
            setError("Add your Spotify Client ID first.");
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

    return {
        clientId, setClientId,
        redirectUri: getRedirectUri(),
        connected: Boolean(tokens),
        connecting, error, track,
        connect, disconnect, togglePlay, next, previous,
    };
}
