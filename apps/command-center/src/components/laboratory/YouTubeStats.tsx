import { useEffect, useState } from "react";
import { Youtube } from "lucide-react";
import { compact, fetchYouTubeChannel, youtubeConnectUrl, type YouTubeState } from "../../lib/youtubeApi";
import "./YouTubeStats.css";

/**
 * The channel's own numbers, in the bar.
 *
 * Subscribers, total views and how many videos are up — the three the
 * channels endpoint actually returns. Comment counts are deliberately
 * not here: YouTube reports those per VIDEO, and nothing in the studio
 * knows which YouTube video a cut became, because publishing is
 * something you do by hand. Showing a zero would be worse than showing
 * nothing.
 *
 * Every failure says which of three different things went wrong, since
 * they need three different actions: nobody has set Google up on the
 * backend, nobody has connected an account, or YouTube itself refused.
 */
const REFRESH_MS = 5 * 60 * 1000;

export default function YouTubeStats() {
    const [state, setState] = useState<YouTubeState | null>(null);

    useEffect(() => {
        let cancelled = false;
        const read = () => {
            void fetchYouTubeChannel().then((next) => { if (!cancelled) setState(next); });
        };
        read();
        // Channel totals move slowly; polling them faster would spend
        // quota to redraw the same three numbers.
        const timer = setInterval(read, REFRESH_MS);
        return () => { cancelled = true; clearInterval(timer); };
    }, []);

    // Nothing at all until the first answer: a placeholder that turns
    // into "not connected" a second later is a flicker, not information.
    if (state === null) return null;

    if (state.status === "not-connected") {
        return (
            <a className="yt yt-connect" href={youtubeConnectUrl()}>
                <Youtube size={15} strokeWidth={2} />
                Connect YouTube
            </a>
        );
    }

    if (state.status === "not-configured" || state.status === "error" || state.status === "no-channel") {
        const why = state.status === "no-channel"
            ? "That Google account has no YouTube channel."
            : state.status === "not-configured" ? state.message : state.message;
        return (
            <span className="yt yt-off" title={why}>
                <Youtube size={15} strokeWidth={2} />
                <span className="yt-off-text">YouTube unavailable</span>
            </span>
        );
    }

    const { channel } = state;
    return (
        <span className="yt" title={`${channel.title} — ${channel.viewCount.toLocaleString()} views`}>
            <Youtube size={15} strokeWidth={2} />
            <span className="yt-stat"><strong>{compact(channel.subscriberCount)}</strong> subs</span>
            <span className="yt-dot" />
            <span className="yt-stat"><strong>{compact(channel.viewCount)}</strong> views</span>
            <span className="yt-dot" />
            <span className="yt-stat"><strong>{channel.videoCount}</strong> up</span>
        </span>
    );
}
