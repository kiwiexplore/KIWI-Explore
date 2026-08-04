// Live space news via The Spaceflight News API (https://spaceflightnewsapi.net/)
// — free, public, no API key required, CORS-enabled for direct browser
// fetches. Second live-data widget alongside weather — see SpaceNewsWidget.

export interface SpaceNewsArticle {
    id: number;
    title: string;
    url: string;
    imageUrl: string;
    newsSite: string;
    summary: string;
    publishedAt: string;
}

export async function fetchSpaceNews(limit = 5): Promise<SpaceNewsArticle[]> {
    const res = await fetch(`https://api.spaceflightnewsapi.net/v4/articles/?limit=${limit}&ordering=-published_at`);
    if (!res.ok) throw new Error(`Spaceflight News API request failed: ${res.status}`);
    const data = await res.json();

    return (data.results ?? []).map((a: {
        id: number; title: string; url: string; image_url: string;
        news_site: string; summary: string; published_at: string;
    }) => ({
        id: a.id,
        title: a.title,
        url: a.url,
        imageUrl: a.image_url,
        newsSite: a.news_site,
        summary: a.summary,
        publishedAt: a.published_at,
    }));
}
