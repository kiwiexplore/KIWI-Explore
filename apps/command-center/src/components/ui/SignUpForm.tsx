import { useState, type FormEvent } from "react";
import "./SignUpForm.css";

interface SignUpFormProps {
    onSubmit: (nickname: string) => void;
}

/**
 * Placeholder registration form — no real backend/auth wired up yet, so
 * this only does client-side sanity checks (fields non-empty, passwords
 * match) before calling `onSubmit` with the nickname. Real account
 * creation, email verification, and password hashing all still need to
 * be built server-side before this is anything more than a UI mock.
 */
export default function SignUpForm({ onSubmit }: SignUpFormProps) {
    const [nickname, setNickname] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (!nickname.trim() || !email.trim() || !password) {
            setError("Please fill in every field.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords don't match.");
            return;
        }
        if (!agreed) {
            setError("Please accept the terms to continue.");
            return;
        }
        setError(null);
        onSubmit(nickname.trim());
    };

    return (
        <form className="signup-form" onSubmit={handleSubmit}>
            <div className="signup-field">
                <label htmlFor="signup-nickname">Nickname</label>
                <input
                    id="signup-nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    autoComplete="nickname"
                />
            </div>

            <div className="signup-field">
                <label htmlFor="signup-email">Email</label>
                <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                />
            </div>

            <div className="signup-field">
                <label htmlFor="signup-password">Password</label>
                <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                />
            </div>

            <div className="signup-field">
                <label htmlFor="signup-confirm">Confirm password</label>
                <input
                    id="signup-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                />
            </div>

            <label className="signup-consent">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                I agree to the Terms of Service and Privacy Policy.
            </label>

            {error && <div className="signup-error">{error}</div>}

            <button type="submit" className="signup-submit">Create account</button>

            <p className="signup-note">
                This is a UI preview only — nothing is sent anywhere yet, and
                the email isn't actually verified.
            </p>
        </form>
    );
}
