import type { ModuleViewProps } from "./types";

interface Network {
    id: string;
    icon: string;
    name: string;
    /** Where the feed itself lives. */
    url: string;
    /** Exactly what standing between here and live numbers. */
    blocker: string;
}

/**
 * Facebook, Instagram and X — as far as a browser alone can take them,
 * which is not far, and the module says so rather than filling the gap
 * with invented figures.
 *
 * All three publish an API and all three put the same wall in front of
 * it: a token that identifies YOU. Facebook and Instagram are one
 * system (Meta's Graph API) and want an OAuth flow plus an app review
 * before they'll hand over even your own posts; X charges for the
 * privilege. None of those tokens can live in a page — a secret shipped
 * to a browser is a published secret — so every one of them waits on
 * the same thing: KIWI's own backend holding the tokens and doing the
 * talking, which is the same blocker email and Google Calendar sit
 * behind (see the module roadmap).
 *
 * Until then this is a launcher that's honest about being one.
 */
const NETWORKS: Network[] = [
    {
        id: "facebook",
        icon: "📘",
        name: "Facebook",
        url: "https://www.facebook.com/",
        blocker: "Meta Graph API — OAuth login plus an app review before it returns anything, so it needs the backend.",
    },
    {
        id: "instagram",
        icon: "📸",
        name: "Instagram",
        url: "https://www.instagram.com/",
        blocker: "Same Graph API as Facebook, and a Professional account on top: personal accounts get no feed at all.",
    },
    {
        id: "x",
        icon: "✖️",
        name: "X",
        url: "https://x.com/home",
        blocker: "The X API is paid at every tier, and its key can't be shipped inside a page either.",
    },
];

export function SocialModule({ mode }: ModuleViewProps) {
    if (mode === "summary") return <>Facebook · Instagram · X — not connected</>;

    return (
        <div className="module-detail">
            <ul className="module-list">
                {NETWORKS.map((network) => (
                    <li key={network.id} className="module-network">
                        <span className="module-network-icon">{network.icon}</span>
                        <span className="module-network-name">{network.name}</span>
                        <a
                            className="module-network-open"
                            href={network.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open ↗
                        </a>
                        <span className="module-network-note">{network.blocker}</span>
                    </li>
                ))}
            </ul>

            <p className="module-note">
                Every other module here talks straight to a public API from
                the browser. These three can't: each one needs a token tied
                to your account, and a token in a page is a token given
                away. They come alive the day KIWI has a backend to hold
                them — the same day mail and Google Calendar do.
            </p>
        </div>
    );
}
