/**
 * Subscription tiers — placeholder pricing/limits for the UI mock (no
 * billing/backend behind this yet, same as the rest of the account
 * system). Each tier gates how many orbit icons and how many widgets
 * per side a user can have active, plus whether the Laboratory is
 * unlocked. "Standard" is the cheapest/base tier, not a separate free
 * tier below it — per explicit product decision.
 */
export type PlanId = "standard" | "pro" | "max";

export interface PlanInfo {
    id: PlanId;
    label: string;
    price: string;
    iconCount: number;
    widgetCount: number; // per side (left and right each get this many)
    hasLab: boolean;
    tagline: string;
}

export const PLANS: PlanInfo[] = [
    { id: "standard", label: "Standard", price: "$4.99/mo", iconCount: 5, widgetCount: 5, hasLab: false, tagline: "The essentials" },
    { id: "pro", label: "Pro", price: "$9.99/mo", iconCount: 8, widgetCount: 8, hasLab: false, tagline: "More room to grow" },
    { id: "max", label: "Max", price: "$19.99/mo", iconCount: 10, widgetCount: 10, hasLab: true, tagline: "Everything, plus the Laboratory" },
];

export function getPlanInfo(id: PlanId): PlanInfo {
    return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
