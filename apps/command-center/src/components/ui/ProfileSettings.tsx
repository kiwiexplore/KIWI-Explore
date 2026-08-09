import { useRef, useState, type ChangeEvent } from "react";
import {
    ArrowLeft, Check, ChevronRight, CreditCard, Grid2x2, Image as ImageIcon,
    Lock, LogOut, Orbit, Sparkles, Upload,
} from "lucide-react";
import ItemPicker from "./ItemPicker";
import AvatarGlyph from "./AvatarGlyph";
import { AVATAR_PRESETS } from "../../state/avatars";
import { BACKGROUND_PRESETS } from "../../state/backgrounds";
import { PLANS } from "../../state/plans";
import { ICON_OPTIONS, LEFT_WIDGET_OPTIONS, RIGHT_WIDGET_OPTIONS, type AccountState } from "../../state/account";
import "./ProfileSettings.css";

interface ProfileSettingsProps {
    account: AccountState;
    onSignOut: () => void;
}

type Page = "menu" | "avatar" | "icons" | "widgets" | "background" | "subscription";

// Shown at the bottom of the Icons/Widgets pickers whenever a higher
// tier would raise the limit — a nudge toward Subscription rather than
// a plan change happening silently. Hidden entirely on the Max plan
// (nothing left to unlock).
function UpgradeHint({ nextPlan, kind, onOpenSubscription }: {
    nextPlan: (typeof PLANS)[number];
    kind: "icons" | "widgets";
    onOpenSubscription: () => void;
}) {
    const amount = kind === "icons" ? nextPlan.iconCount : nextPlan.widgetCount;
    const suffix = kind === "widgets" ? " per side" : "";
    return (
        <button type="button" className="profile-settings-upgrade-hint" onClick={onOpenSubscription}>
            <Sparkles size={14} strokeWidth={2} />
            <span>{nextPlan.label} unlocks {amount} {kind}{suffix}{nextPlan.hasLab ? " + the Laboratory" : ""}.</span>
            <ChevronRight size={14} strokeWidth={2} />
        </button>
    );
}

/**
 * Account settings — opened by clicking the profile pill once "signed
 * in", from either the Dashboard (TopBar) or Laboratory
 * (LaboratoryTopBar) — both open the exact same drawer/component,
 * reading and writing the exact same `account` (see state/account.ts,
 * owned by App.tsx), so a change made from one scene shows up in the
 * other immediately. A small internal menu → sub-page navigation (not
 * drag-and-drop, not a router) since a floating, backdrop-blurred
 * drawer over a live 3D canvas doesn't have room for everything at
 * once. Everything here is a client-side-only mock — nothing persists
 * across a reload yet (no backend/database).
 */
export default function ProfileSettings({ account, onSignOut }: ProfileSettingsProps) {
    const {
        nickname, avatar, setAvatar, plan, setPlan,
        activeIconIds, setActiveIconIds,
        activeLeftWidgetIds, setActiveLeftWidgetIds,
        activeRightWidgetIds, setActiveRightWidgetIds,
        background, setBackground,
    } = account;
    const [page, setPage] = useState<Page>("menu");
    const bgFileInputRef = useRef<HTMLInputElement>(null);
    const avatarFileInputRef = useRef<HTMLInputElement>(null);
    const currentPlanInfo = PLANS.find((p) => p.id === plan) ?? PLANS[0];
    const planIndex = PLANS.findIndex((p) => p.id === plan);
    const nextPlan = planIndex >= 0 && planIndex < PLANS.length - 1 ? PLANS[planIndex + 1] : null;

    const handleBgFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") setBackground({ type: "custom", dataUrl: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const handleAvatarFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") setAvatar({ type: "custom", dataUrl: reader.result });
        };
        reader.readAsDataURL(file);
    };

    if (page !== "menu") {
        const titles: Record<Exclude<Page, "menu">, string> = {
            avatar: "Avatar",
            icons: "Icons",
            widgets: "Widgets",
            background: "Background",
            subscription: "Subscription",
        };
        return (
            <div className="profile-settings">
                <button type="button" className="profile-settings-back" onClick={() => setPage("menu")}>
                    <ArrowLeft size={14} strokeWidth={2} />
                    {titles[page]}
                </button>

                {page === "avatar" && (
                    <div className="profile-settings-bg-grid">
                        {AVATAR_PRESETS.map((preset) => {
                            const isActive = avatar.type === "preset" && avatar.id === preset.id;
                            const Icon = preset.Icon;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    className={`profile-settings-avatar-swatch${isActive ? " profile-settings-avatar-swatch-active" : ""}`}
                                    onClick={() => setAvatar({ type: "preset", id: preset.id })}
                                >
                                    {isActive ? <Check size={18} strokeWidth={2.5} /> : <Icon size={22} strokeWidth={1.5} />}
                                    <span>{preset.label}</span>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            className={`profile-settings-avatar-swatch${avatar.type === "custom" ? " profile-settings-avatar-swatch-active" : ""}`}
                            onClick={() => avatarFileInputRef.current?.click()}
                        >
                            {avatar.type === "custom" ? <Check size={18} strokeWidth={2.5} /> : <Upload size={18} strokeWidth={1.75} />}
                            <span>{avatar.type === "custom" ? "Custom photo" : "Upload your own"}</span>
                        </button>
                        <input ref={avatarFileInputRef} type="file" accept="image/*" onChange={handleAvatarFileChosen} style={{ display: "none" }} />
                    </div>
                )}

                {page === "icons" && (
                    <>
                        <ItemPicker
                            allItems={ICON_OPTIONS}
                            activeIds={activeIconIds}
                            maxCount={currentPlanInfo.iconCount}
                            onChange={setActiveIconIds}
                        />
                        {nextPlan && <UpgradeHint nextPlan={nextPlan} kind="icons" onOpenSubscription={() => setPage("subscription")} />}
                    </>
                )}

                {page === "widgets" && (
                    <>
                        <div className="profile-settings-widget-columns">
                            <div>
                                <div className="item-picker-subheading">Left column</div>
                                <ItemPicker
                                    allItems={LEFT_WIDGET_OPTIONS}
                                    activeIds={activeLeftWidgetIds}
                                    maxCount={currentPlanInfo.widgetCount}
                                    onChange={setActiveLeftWidgetIds}
                                />
                            </div>
                            <div>
                                <div className="item-picker-subheading">Right column</div>
                                <ItemPicker
                                    allItems={RIGHT_WIDGET_OPTIONS}
                                    activeIds={activeRightWidgetIds}
                                    maxCount={currentPlanInfo.widgetCount}
                                    onChange={setActiveRightWidgetIds}
                                />
                            </div>
                        </div>
                        {nextPlan && <UpgradeHint nextPlan={nextPlan} kind="widgets" onOpenSubscription={() => setPage("subscription")} />}
                    </>
                )}

                {page === "background" && (
                    <div className="profile-settings-bg-grid">
                        {BACKGROUND_PRESETS.map((preset) => {
                            const isActive = background.type === "preset" && background.id === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    className={`profile-settings-bg-swatch${isActive ? " profile-settings-bg-swatch-active" : ""}`}
                                    style={{ background: preset.swatch }}
                                    onClick={() => setBackground({ type: "preset", id: preset.id })}
                                >
                                    {isActive && <Check size={16} strokeWidth={2.5} />}
                                    <span>{preset.label}</span>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            className={`profile-settings-bg-swatch profile-settings-bg-upload${background.type === "custom" ? " profile-settings-bg-swatch-active" : ""}`}
                            onClick={() => bgFileInputRef.current?.click()}
                        >
                            {background.type === "custom" ? <Check size={16} strokeWidth={2.5} /> : <Upload size={16} strokeWidth={2} />}
                            <span>{background.type === "custom" ? "Custom image" : "Upload your own"}</span>
                        </button>
                        <input ref={bgFileInputRef} type="file" accept="image/*" onChange={handleBgFileChosen} style={{ display: "none" }} />
                    </div>
                )}

                {page === "subscription" && (
                    <div className="profile-settings-plans">
                        {PLANS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className={`profile-settings-plan${p.id === plan ? " profile-settings-plan-active" : ""}`}
                                onClick={() => setPlan(p.id)}
                            >
                                <div className="profile-settings-plan-header">
                                    <span className="profile-settings-plan-name">{p.label}</span>
                                    <span className="profile-settings-plan-price">{p.price}</span>
                                </div>
                                <div className="profile-settings-plan-tagline">{p.tagline}</div>
                                <ul className="profile-settings-plan-features">
                                    <li>{p.iconCount} icons</li>
                                    <li>{p.widgetCount} widgets per side</li>
                                    <li>{p.hasLab ? "Laboratory included" : <span className="profile-settings-plan-locked"><Lock size={11} strokeWidth={2} /> Laboratory</span>}</li>
                                </ul>
                                {p.id === plan && <div className="profile-settings-plan-current">Current plan</div>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="profile-settings">
            <div className="profile-settings-avatar-row">
                <button type="button" className="profile-settings-avatar" onClick={() => setPage("avatar")} aria-label="Change avatar">
                    <AvatarGlyph avatar={avatar} size={48} />
                </button>
                <div>
                    <div className="profile-settings-section-label">{nickname}</div>
                    <div className="profile-settings-avatar-hint">{currentPlanInfo.label} plan</div>
                </div>
            </div>

            <button type="button" className="profile-settings-section profile-settings-section-clickable" onClick={() => setPage("subscription")}>
                <span className="profile-settings-section-label">
                    <CreditCard size={16} strokeWidth={1.75} />
                    Subscription
                </span>
                <span className="profile-settings-section-hint">{currentPlanInfo.label}</span>
            </button>

            <button type="button" className="profile-settings-section profile-settings-section-clickable" onClick={() => setPage("icons")}>
                <span className="profile-settings-section-label">
                    <Orbit size={16} strokeWidth={1.75} />
                    Icons
                </span>
                <span className="profile-settings-section-hint">{activeIconIds.length} / {currentPlanInfo.iconCount}</span>
            </button>

            <button type="button" className="profile-settings-section profile-settings-section-clickable" onClick={() => setPage("widgets")}>
                <span className="profile-settings-section-label">
                    <Grid2x2 size={16} strokeWidth={1.75} />
                    Widgets
                </span>
                <span className="profile-settings-section-hint">{activeLeftWidgetIds.length + activeRightWidgetIds.length} / {currentPlanInfo.widgetCount * 2}</span>
            </button>

            <button type="button" className="profile-settings-section profile-settings-section-clickable" onClick={() => setPage("background")}>
                <span className="profile-settings-section-label">
                    <ImageIcon size={16} strokeWidth={1.75} />
                    Background
                </span>
                <span className="profile-settings-section-hint">Change</span>
            </button>

            <button type="button" className="profile-settings-signout" onClick={onSignOut}>
                <LogOut size={14} strokeWidth={1.75} style={{ marginRight: 6, verticalAlign: -2 }} />
                Sign out
            </button>
        </div>
    );
}
