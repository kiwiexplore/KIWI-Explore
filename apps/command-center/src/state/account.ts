import { useState } from "react";
import { DEFAULT_AVATAR, type AvatarChoice } from "./avatars";
import { DEFAULT_BACKGROUND, type BackgroundChoice } from "./backgrounds";
import { PLANS, type PlanId } from "./plans";
import { orbitModules } from "./orbitModules";
import { leftWidgets, rightWidgets } from "../components/brain/sceneWidgets";
import type { PickerItem } from "../components/ui/ItemPicker";

export const ICON_OPTIONS: PickerItem[] = orbitModules.map((m) => ({ id: m.id, label: m.label, icon: m.icon }));
export const LEFT_WIDGET_OPTIONS: PickerItem[] = leftWidgets.map((w) => ({ id: w.id, label: w.title }));
export const RIGHT_WIDGET_OPTIONS: PickerItem[] = rightWidgets.map((w) => ({ id: w.id, label: w.title }));

const STANDARD_PLAN = PLANS[0];

/**
 * The whole per-user account/profile — identity (nickname/avatar/plan)
 * AND per-user customization (icons/widgets/background) — lifted up to
 * App.tsx so it survives switching between the Dashboard and Laboratory,
 * and so ProfileSettings can be opened (and edit the same state) from
 * either scene instead of two separate copies. Previously identity was
 * local to BrainScene3D (reset on every Laboratory switch) and
 * ProfileSettings was only reachable from the Dashboard at all. Still
 * fully client-side/mock — nothing persists across a reload either
 * way, same as the rest of the account system.
 */
export interface AccountState {
    nickname: string | null;
    setNickname: (nickname: string | null) => void;
    avatar: AvatarChoice;
    setAvatar: (avatar: AvatarChoice) => void;
    plan: PlanId;
    // Also clamps active icon/widget selections down to the new plan's
    // limits when downgrading — see the hook body.
    setPlan: (plan: PlanId) => void;
    activeIconIds: string[];
    setActiveIconIds: (ids: string[]) => void;
    activeLeftWidgetIds: string[];
    setActiveLeftWidgetIds: (ids: string[]) => void;
    activeRightWidgetIds: string[];
    setActiveRightWidgetIds: (ids: string[]) => void;
    background: BackgroundChoice;
    setBackground: (choice: BackgroundChoice) => void;
}

export function useAccountState(): AccountState {
    const [nickname, setNickname] = useState<string | null>(null);
    const [avatar, setAvatar] = useState<AvatarChoice>(DEFAULT_AVATAR);
    const [plan, setPlanRaw] = useState<PlanId>("standard");
    const [activeIconIds, setActiveIconIds] = useState<string[]>(orbitModules.slice(0, STANDARD_PLAN.iconCount).map((m) => m.id));
    const [activeLeftWidgetIds, setActiveLeftWidgetIds] = useState<string[]>(leftWidgets.slice(0, STANDARD_PLAN.widgetCount).map((w) => w.id));
    const [activeRightWidgetIds, setActiveRightWidgetIds] = useState<string[]>(rightWidgets.slice(0, STANDARD_PLAN.widgetCount).map((w) => w.id));
    const [background, setBackground] = useState<BackgroundChoice>(DEFAULT_BACKGROUND);

    const setPlan = (nextPlan: PlanId) => {
        setPlanRaw(nextPlan);
        const info = PLANS.find((p) => p.id === nextPlan) ?? PLANS[0];
        setActiveIconIds((ids) => ids.slice(0, info.iconCount));
        setActiveLeftWidgetIds((ids) => ids.slice(0, info.widgetCount));
        setActiveRightWidgetIds((ids) => ids.slice(0, info.widgetCount));
    };

    return {
        nickname, setNickname,
        avatar, setAvatar,
        plan, setPlan,
        activeIconIds, setActiveIconIds,
        activeLeftWidgetIds, setActiveLeftWidgetIds,
        activeRightWidgetIds, setActiveRightWidgetIds,
        background, setBackground,
    };
}
