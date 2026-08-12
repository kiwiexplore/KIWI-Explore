// Ambient types for Spotify's Web Playback SDK (loaded at runtime from
// sdk.scdn.co, not an npm package — see lib/spotifyPlaybackSdk.ts).
// Trimmed to only what this app actually calls.

declare namespace Spotify {
    interface PlaybackTrack {
        name: string;
        uri: string;
        artists: { name: string }[];
        album: { images: { url: string }[] };
    }

    interface PlaybackState {
        paused: boolean;
        position: number;
        duration: number;
        track_window: { current_track: PlaybackTrack };
    }

    interface PlayerInit {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume?: number;
    }

    class Player {
        constructor(options: PlayerInit);
        connect(): Promise<boolean>;
        disconnect(): void;
        addListener(event: "ready" | "not_ready", callback: (data: { device_id: string }) => void): boolean;
        addListener(event: "player_state_changed", callback: (state: PlaybackState | null) => void): boolean;
        addListener(
            event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
            callback: (data: { message: string }) => void,
        ): boolean;
        getCurrentState(): Promise<PlaybackState | null>;
        pause(): Promise<void>;
        resume(): Promise<void>;
        togglePlay(): Promise<void>;
        // Unlocks this tab's audio output for the SDK's playback element.
        // Browsers with strict autoplay policies (Safari in particular,
        // including iOS) otherwise let the device register with Spotify
        // and accept play commands while never actually producing sound —
        // must be called synchronously inside a real user gesture (a
        // click), not from inside an async callback. Optional because
        // older SDK builds (and non-Safari browsers, which don't need it)
        // may not implement it.
        activateElement?(): void;
    }
}

interface Window {
    Spotify: typeof Spotify;
    onSpotifyWebPlaybackSDKReady: () => void;
}
