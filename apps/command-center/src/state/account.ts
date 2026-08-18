import { useState } from "react";
import { DEFAULT_BACKGROUND, type BackgroundChoice } from "./backgrounds";

/**
 * Per-user customization, lifted up to App.tsx so both scenes share one
 * copy of it.
 *
 * This used to carry a whole account — nickname, avatar, plan, plus the
 * icon/widget selections — edited through a ProfileSettings drawer
 * reachable from either top bar. All of that is gone (removed per
 * explicit request: the account isn't needed at this stage), together
 * with the orbit icons and widget columns those selections configured.
 * What's left is the scene backdrop, which both the Dashboard and
 * Laboratory paint themselves with.
 *
 * Kept as a hook owned by App.tsx rather than local state in either
 * scene so the choice survives switching between them — and so that
 * when identity comes back (with a real backend behind it, unlike the
 * fully client-side mock this replaced) there's already one place for
 * it to live. state/plans.ts and state/avatars.ts are still here for
 * the same reason: the plan tiers are part of the product model, they
 * just have no UI in front of them right now.
 */
export interface AccountState {
    background: BackgroundChoice;
    setBackground: (choice: BackgroundChoice) => void;
}

export function useAccountState(): AccountState {
    const [background, setBackground] = useState<BackgroundChoice>(DEFAULT_BACKGROUND);
    return { background, setBackground };
}
