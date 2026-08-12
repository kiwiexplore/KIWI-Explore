// Loads Spotify's Web Playback SDK (a script tag from sdk.scdn.co,
// there's no npm package for it) and wraps it in a promise-based
// creator. Once connected, this browser tab registers itself as a
// real Spotify Connect device ("KIWI") — playback then happens here,
// independent of whatever else is signed into the account (phone,
// desktop app). Requires Spotify Premium: Spotify rejects playback
// commands from Free accounts with an account_error.
// Reference: https://developer.spotify.com/documentation/web-playback-sdk

let sdkLoadPromise: Promise<void> | null = null;

function loadSdkScript(): Promise<void> {
    if (sdkLoadPromise) return sdkLoadPromise;
    sdkLoadPromise = new Promise((resolve, reject) => {
        if (window.Spotify) {
            resolve();
            return;
        }
        window.onSpotifyWebPlaybackSDKReady = () => resolve();
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        script.onerror = () => reject(new Error("Could not load Spotify's playback SDK."));
        document.head.appendChild(script);
    });
    return sdkLoadPromise;
}

export interface CreatePlayerOptions {
    getOAuthToken: (callback: (token: string) => void) => void;
    onDeviceReady: (deviceId: string) => void;
    onDeviceOffline: () => void;
    onError: (message: string) => void;
}

export async function createSpotifyPlayer(options: CreatePlayerOptions): Promise<Spotify.Player> {
    await loadSdkScript();

    const player = new window.Spotify.Player({
        name: "KIWI",
        getOAuthToken: options.getOAuthToken,
        volume: 0.7,
    });

    player.addListener("ready", ({ device_id }) => options.onDeviceReady(device_id));
    player.addListener("not_ready", () => options.onDeviceOffline());
    player.addListener("initialization_error", ({ message }) => options.onError(message));
    player.addListener("authentication_error", ({ message }) => options.onError(message));
    player.addListener("account_error", () => options.onError("Spotify Premium is required to play music inside KIWI."));
    player.addListener("playback_error", ({ message }) => options.onError(message));

    const connected = await player.connect();
    if (!connected) throw new Error("Could not connect KIWI to Spotify.");
    return player;
}
