import { useState } from "react";
import { DEFAULT_AVATAR, type AvatarChoice } from "./avatars";
import type { PlanId } from "./plans";

/**
 * The identity slice of the account — nickname, avatar, and plan —
 * lifted up to App.tsx so it survives switching between the Dashboard
 * and Laboratory (previously local to BrainScene3D, so it reset
 * every time Laboratory unmounted it). Icon/widget selection and
 * background stay local to BrainScene3D on purpose — Laboratory
 * doesn't render any of that, so there's nothing for it to share.
 * Still fully client-side/mock — nothing persists across a reload
 * either way, same as the rest of the account system.
 */
export interface AccountState {
    nickname: string | null;
    setNickname: (nickname: string | null) => void;
    avatar: AvatarChoice;
    setAvatar: (avatar: AvatarChoice) => void;
    plan: PlanId;
    setPlan: (plan: PlanId) => void;
}

export function useAccountState(): AccountState {
    const [nickname, setNickname] = useState<string | null>(null);
    const [avatar, setAvatar] = useState<AvatarChoice>(DEFAULT_AVATAR);
    const [plan, setPlan] = useState<PlanId>("standard");
    return { nickname, setNickname, avatar, setAvatar, plan, setPlan };
}
