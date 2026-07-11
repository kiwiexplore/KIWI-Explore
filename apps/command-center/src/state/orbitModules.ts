import type { OrbitModuleDefinition } from "../types/orbitModule";

/**
 * Modules displayed orbiting the Brain on the KIWI HQ dashboard.
 * Rendered clockwise starting from the top (see OrbitRing.tsx).
 *
 * `badgeCount` and `description` are placeholders for now — real counts
 * (unread messages, upcoming events...) get wired in during Phase 2
 * (Intelligence / Integrations), same as `state/widgets.ts`.
 */
export const orbitModules: OrbitModuleDefinition[] = [
    { id: "news", icon: "📰", label: "News", description: "Real-time updates", badgeCount: 5 },
    { id: "adventure", icon: "⛰️", label: "Adventure", description: "Trails · Weather · Gear", badgeCount: 2 },
    { id: "calendar", icon: "📅", label: "Calendar", description: "Events · Tasks · Schedule", badgeCount: 5 },
    { id: "projects", icon: "📁", label: "Projects", description: "Goals · Progress · Planning", badgeCount: 4 },
    { id: "finance", icon: "📈", label: "Finance", description: "Investments · Markets · Crypto", badgeCount: 7 },
    { id: "learning", icon: "📖", label: "Learning", description: "Courses · Books · Skills" },
    { id: "documents", icon: "📄", label: "Documents", description: "Files · Notes · Knowledge Base", badgeCount: 12 },
    { id: "health", icon: "❤️", label: "Health", description: "Activity · Sleep · Nutrition" },
    { id: "communication", icon: "✉️", label: "Communication", description: "Email · Messages · Contacts", badgeCount: 8 },
    { id: "travel", icon: "✈️", label: "Travel", description: "Flights · Stays · Itineraries", badgeCount: 3 },
];