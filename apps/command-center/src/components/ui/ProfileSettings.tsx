import { Grid2x2, Image, LogOut, Orbit, UserCircle2 } from "lucide-react";
import "./ProfileSettings.css";

interface ProfileSettingsProps {
    nickname: string;
    onSignOut: () => void;
}

/**
 * Placeholder account settings panel — opened by clicking the profile
 * pill once "signed in" (see SignUpForm/BrainScene3D). Each section
 * below is structural only for now (no actual widget/icon/background
 * picker wired up yet) — it exists so the layout/entry points are
 * already in place for when per-user customization (see the
 * multi-tenant product notes) gets built.
 */
export default function ProfileSettings({ nickname, onSignOut }: ProfileSettingsProps) {
    return (
        <div className="profile-settings">
            <div className="profile-settings-avatar-row">
                <div className="profile-settings-avatar">
                    <UserCircle2 size={26} strokeWidth={1.5} />
                </div>
                <div>
                    <div className="profile-settings-section-label">{nickname}</div>
                    <div className="profile-settings-avatar-hint">Click to change profile picture (soon)</div>
                </div>
            </div>

            <div className="profile-settings-section">
                <span className="profile-settings-section-label">
                    <Grid2x2 size={16} strokeWidth={1.75} />
                    Widgets
                </span>
                <span className="profile-settings-section-hint">Coming soon</span>
            </div>

            <div className="profile-settings-section">
                <span className="profile-settings-section-label">
                    <Orbit size={16} strokeWidth={1.75} />
                    Icons &amp; connected apps
                </span>
                <span className="profile-settings-section-hint">Coming soon</span>
            </div>

            <div className="profile-settings-section">
                <span className="profile-settings-section-label">
                    <Image size={16} strokeWidth={1.75} />
                    Background
                </span>
                <span className="profile-settings-section-hint">Coming soon</span>
            </div>

            <button type="button" className="profile-settings-signout" onClick={onSignOut}>
                <LogOut size={14} strokeWidth={1.75} style={{ marginRight: 6, verticalAlign: -2 }} />
                Sign out
            </button>
        </div>
    );
}
