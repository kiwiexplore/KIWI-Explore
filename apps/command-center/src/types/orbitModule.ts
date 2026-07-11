/**
 * Describes one module icon orbiting the Brain on the KIWI HQ dashboard
 * (e.g. Travel, News, Calendar). Purely presentational data for now —
 * clicking these will later route into real feature modules.
 */
export interface OrbitModuleDefinition {
    id: string;
    icon: string;
    label: string;
    description: string;
    badgeCount?: number;
}