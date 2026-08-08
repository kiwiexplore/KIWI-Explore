import { useRef, useState, type ChangeEvent } from "react";
import {
    ArrowLeft, Check, CreditCard, Grid2x2, Image as ImageIcon,
    Lock, LogOut, Orbit, Upload, UserCircle2,
} from "lucide-react";
import ItemPicker, { type PickerItem } from "./ItemPicker";
import { BACKGROUND_PRESETS, type BackgroundChoice } from "../../state/backgrounds";
import { PLANS, type PlanId } from "../../state/plans";
import "./ProfileSettings.css";

interface ProfileSettingsProps {
    nickname: string;
    onSignOut: () => void;
    plan: PlanId;
    onPlanChange: (plan: PlanId) => void;
    iconOptions: PickerItem[];
    activeIconIds: string[];
    onActiveIconIdsChange: (ids: string[]) => void;
    leftWidgetOptions: PickerItem[];
    activeLeftWidgetIds: string[];
    onActiveLeftWidgetIdsChange: (ids: string[]) => void;
    rightWidgetOptions: PickerItem[];
    activeRightWidgetIds: string[];
    onActiveRightWidgetIdsChange: (ids: string[]) => void;
    background: BackgroundChoice;
    onBackgroundChange: (choice: BackgroundChoice) => void;
}

type Page = "menu" | "icons" | "widgets" | "background" | "subscription";

/**
 * Account settings — opened by clicking the profile pill once "signed
 * in" (see SignUpForm/BrainScene3D). A small internal menu → sub-page
 * navigation (not drag-and-drop, not a router) since a floating,
 * backdrop-blurred drawer over a live 3D canvas doesn't have room for
 * everything at once. Everything here is a client-side-only mock, same
 * as the rest of the account system — plan changes, icon/widget
 * selections, and the background all live in BrainScene3D's React
 * state, nothing persists across a reload yet (no backend/database).
 */
export default function ProfileSettings(props: ProfileSettingsProps) {
    const { nickname, onSignOut, plan, onPlanChange, background, onBackgroundChange } = props;
    const [page, setPage] = useState<Page>("menu");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentPlanInfo = PLANS.find((p) => p.id === plan) ?? PLANS[0];

    const handleFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") onBackgroundChange({ type: "custom", dataUrl: reader.result });
        };
        reader.readAsDataURL(file);
    };

    if (page !== "menu") {
        const titles: Record<Exclude<Page, "menu">, string> = {
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

                {page === "icons" && (
                    <ItemPicker
                        allItems={props.iconOptions}
                        activeIds={props.activeIconIds}
                        maxCount={currentPlanInfo.iconCount}
                        onChange={props.onActiveIconIdsChange}
                    />
                )}

                {page === "widgets" && (
                    <div className="profile-settings-widget-columns">
                        <div>
                            <div className="item-picker-subheading">Left column</div>
                            <ItemPicker
                                allItems={props.leftWidgetOptions}
                                activeIds={props.activeLeftWidgetIds}
                                maxCount={currentPlanInfo.widgetCount}
                                onChange={props.onActiveLeftWidgetIdsChange}
                            />
                        </div>
                        <div>
                            <div className="item-picker-subheading">Right column</div>
                            <ItemPicker
                                allItems={props.rightWidgetOptions}
                                activeIds={props.activeRightWidgetIds}
                                maxCount={currentPlanInfo.widgetCount}
                                onChange={props.onActiveRightWidgetIdsChange}
                            />
                        </div>
                    </div>
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
                                    onClick={() => onBackgroundChange({ type: "preset", id: preset.id })}
                                >
                                    {isActive && <Check size={16} strokeWidth={2.5} />}
                                    <span>{preset.label}</span>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            className={`profile-settings-bg-swatch profile-settings-bg-upload${background.type === "custom" ? " profile-settings-bg-swatch-active" : ""}`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {background.type === "custom" ? <Check size={16} strokeWidth={2.5} /> : <Upload size={16} strokeWidth={2} />}
                            <span>{background.type === "custom" ? "Custom image" : "Upload your own"}</span>
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChosen} style={{ display: "none" }} />
                    </div>
                )}

                {page === "subscription" && (
                    <div className="profile-settings-plans">
                        {PLANS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className={`profile-settings-plan${p.id === plan ? " profile-settings-plan-active" : ""}`}
                                onClick={() => onPlanChange(p.id)}
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
                <div className="profile-settings-avatar">
                    <UserCircle2 size={26} strokeWidth={1.5} />
                </div>
                <div>
                    <div className="profile-settings-section-label">{nickname}</div>
                    <div className="profile-settings-avatar-hint">{currentPlanInfo.label} plan</div>
                </div>
            </div>

            <button type="button" className="profile-settings-section profile-settings-section-clickable" onClick={() => setPage("icons")}>
                <span className="profile-settings-section-label">
                    <Orbit size={16} strokeWidth={1.75} />
                    Icons
                </span>
                <span className="profile-settings-section-hint">{props.activeIconIds.length} / {currentPlanInfo.iconCount}</span>
            </button>

            <button type="button" className="profile-settings-section profile-settings-section-clickable" onClick={() => setPage("widgets")}>
                <span className="profile-settings-section-label">
                    <Grid2x2 size={16} strokeWidth={1.75} />
                    Widgets
                </span>
                <span className="profile-settings-section-hint">{props.activeLeftWidgetIds.length + props.activeRightWidgetIds.length} / {currentPlanInfo.widgetCount * 2}</span>
            </button>

            <button type="button" className="profile-settings-section profile-settings-section-clickable" onClick={() => setPage("background")}>
                <span className="profile-settings-section-label">
                    <ImageIcon size={16} strokeWidth={1.75} />
                    Background
                </span>
                <span className="profile-settings-section-hint">Change</span>
            </button>

            <button type="button" className="profile-settings-section profile-settings-section-clickable" onClick={() => setPage("subscription")}>
                <span className="profile-settings-section-label">
                    <CreditCard size={16} strokeWidth={1.75} />
                    Subscription
                </span>
                <span className="profile-settings-section-hint">{currentPlanInfo.label}</span>
            </button>

            <button type="button" className="profile-settings-signout" onClick={onSignOut}>
                <LogOut size={14} strokeWidth={1.75} style={{ marginRight: 6, verticalAlign: -2 }} />
                Sign out
            </button>
        </div>
    );
}
