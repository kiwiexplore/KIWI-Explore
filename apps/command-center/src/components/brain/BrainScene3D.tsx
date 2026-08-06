import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { AmbientLight, type Line, type Points } from "three";
import BrainSystem3D from "./BrainSystem3D";
import GlowLayer from "./GlowLayer";
import OrbitRing3D from "./OrbitRing3D";
import TopBar from "./TopBar";
import VoiceBar from "./VoiceBar";
import Widget from "../widget/Widget";
import DetailDrawer, { type DetailDrawerContent } from "../ui/DetailDrawer";
import SignUpForm from "../ui/SignUpForm";
import ProfileSettings from "../ui/ProfileSettings";
import InfoPanel from "../ui/InfoPanel";
import WeatherWidget from "./WeatherWidget";
import SpaceNewsWidget from "./SpaceNewsWidget";
import { leftWidgets, rightWidgets } from "./sceneWidgets";
import { orbitModules } from "../../state/orbitModules";
import milkyWayPhoto from "../../assets/milky-way-background.jpg";
import "./BrainScene3D.css";

// A uniform dark scrim over the whole photo (it was too bright/busy for
// the brain's thin cyan lines to read clearly against it), plus a soft
// edge vignette on top (transparent in the middle, darker at the very
// edges — NOT a centered bright-to-dark radial, which read as a glowing
// "bubble" behind the brain in an earlier procedural version).
const BACKGROUND_LAYERS = [
    "linear-gradient(rgba(0,0,0,0.32), rgba(0,0,0,0.32))",
    "radial-gradient(ellipse 140% 120% at 50% 50%, transparent 50%, rgba(0,0,0,0.35) 100%)",
    `url(${milkyWayPhoto})`,
].join(", ");

function anchorFromEvent(event: MouseEvent<HTMLElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Test harness for the 3D Brain — Canvas, camera, lights, and the Brain
 * itself (BrainSystem3D = NeuronLayer + ConnectionLayer + EnergyLayer)
 * plus GlowLayer (SelectiveBloom) and the orbiting module icons.
 *
 * No OrbitControls — the camera is fully static (fixed position/FOV, no
 * rotate/pan/zoom). Only BrainSystem3D itself rotates, driven by
 * dragging directly on the brain (see its own pointer handlers) or its
 * own idle auto-spin when not being dragged.
 *
 * Layout: a TopBar sits above everything, left/right widget columns
 * flank the brain Canvas (a handful of pinned widgets each, per explicit
 * request — Weather/Date left, YouTube right), and the REST of the
 * widgets live in a horizontally-scrollable row below the brain. This is
 * still the isolated 3D preview harness, not the final wired-up
 * Dashboard — see App.tsx.
 *
 * Background is a real photo (a static image, CSS background-image
 * behind the transparent Canvas) plus a soft edge vignette. This
 * replaced an earlier procedural canvas-generated Milky Way + drei
 * Stars + Sparkles setup — after several rounds of tuning (wrong scale,
 * stray glow blobs, drifting "lights") a real photo turned out simpler
 * and better-looking than continuing to chase a procedural approximation
 * of one. Also fully static per feedback — no drifting particles.
 *
 * Both the brain's internal pulse Line objects (via EnergyLayer's
 * onReady, threaded through BrainSystem3D) AND the icons' hover-glow
 * Points objects (via OrbitRing3D's onHoverPointsReady) are lifted up
 * here and merged into one selection, purely so GlowLayer's
 * SelectiveBloom can target exactly those objects — see GlowLayer's doc
 * comment for why a plain global-threshold Bloom couldn't do this.
 *
 * Clicking a widget or an orbit icon opens DetailDrawer with that item's
 * full info, anchored right where the clicked thing is on screen —
 * deliberately not a fixed side panel or full-screen modal, so the brain
 * stays visible/"within reach" while it's open (see DetailDrawer's own
 * doc comment). Sign-in/profile use the exact same DetailDrawer, just
 * with a form or settings list as the body instead of widget text — see
 * handleSignInClick/handleProfileClick below. There's no real backend
 * behind any of this yet (see SignUpForm's own note) — `nickname` just
 * lives in local state so the logged-in-vs-not UI flow can be reviewed
 * before real auth exists.
 */
export default function BrainScene3D() {
    const ambientLight = useMemo(() => new AmbientLight(0xffffff, 0.5), []);
    const [pulseLines, setPulseLines] = useState<Line[]>([]);
    const [hoverPoints, setHoverPoints] = useState<Points[]>([]);
    const [detail, setDetail] = useState<DetailDrawerContent | null>(null);
    // Which orbit icon's drawer is open, if any — kept separate from
    // `detail` itself (which also covers widgets) so OrbitRing3D can use
    // it to keep that one icon's hover glow lit even once the mouse has
    // moved away, e.g. toward the drawer's content.
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [nickname, setNickname] = useState<string | null>(null);

    const closeDetail = () => {
        setDetail(null);
        setActiveModuleId(null);
    };

    const handleModuleClick = (moduleId: string, anchor: { x: number; y: number }) => {
        const module = orbitModules.find((m) => m.id === moduleId);
        if (!module) return;
        setActiveModuleId(moduleId);
        setDetail({
            title: module.label,
            subtitle: module.description,
            anchor,
            body: module.badgeCount !== undefined
                ? `${module.badgeCount} new since you last checked.`
                : "Nothing new right now.",
        });
    };

    const handleWidgetClick = (w: { title: string }, anchor: { x: number; y: number }, body: ReactNode) => {
        setDetail({ title: w.title, body, anchor });
    };

    // Shared by the live-data widgets (Weather, Space News) — they build
    // their own detail body (forecast/article list) internally, unlike
    // the placeholder widgets above whose body is just static text.
    const openDetail = (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => {
        setDetail({ title, anchor, body, maxHeight });
    };

    const handleSignInClick = (event: MouseEvent<HTMLElement>) => {
        const anchor = anchorFromEvent(event);
        setDetail({
            title: "Create your account",
            anchor,
            maxHeight: 520,
            body: <SignUpForm onSubmit={(name) => { setNickname(name); closeDetail(); }} />,
        });
    };

    const handleProfileClick = (event: MouseEvent<HTMLElement>) => {
        const anchor = anchorFromEvent(event);
        setDetail({
            title: "Profile & settings",
            anchor,
            maxHeight: 420,
            body: <ProfileSettings nickname={nickname ?? ""} onSignOut={() => { setNickname(null); closeDetail(); }} />,
        });
    };

    const handleInfoClick = (event: MouseEvent<HTMLElement>) => {
        const anchor = anchorFromEvent(event);
        setDetail({
            title: "Info",
            anchor,
            maxHeight: 420,
            body: <InfoPanel />,
        });
    };

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                backgroundColor: "#050816",
                backgroundImage: BACKGROUND_LAYERS,
                backgroundSize: "auto, auto, cover",
                backgroundPosition: "center, center, center",
                backgroundRepeat: "no-repeat, no-repeat, no-repeat",
                backgroundAttachment: "fixed, fixed, fixed",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <TopBar nickname={nickname} onSignInClick={handleSignInClick} onProfileClick={handleProfileClick} onInfoClick={handleInfoClick} />

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: "1.15fr 2.5fr 1.15fr",
                    gap: 26,
                    padding: "8px 24px",
                    boxSizing: "border-box",
                }}
            >
                <aside className="side-widget-column">
                    {leftWidgets.map((w) => {
                        if (w.id === "weather") return <WeatherWidget key={w.id} onOpenDetail={openDetail} />;
                        if (w.id === "space-news") return <SpaceNewsWidget key={w.id} onOpenDetail={openDetail} />;
                        return (
                            <Widget
                                key={w.id}
                                definition={w}
                                onClick={(e) => handleWidgetClick(w, anchorFromEvent(e), w.body)}
                            />
                        );
                    })}
                </aside>

                <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                    <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                        <Canvas camera={{ position: [0, 0, 4], fov: 50 }} gl={{ alpha: true }}>
                            <primitive object={ambientLight} />
                            {/* Brain + orbit ring scaled up together (not just the
                                brain alone) so the icons grow/move outward right
                                along with it — since RADIUS etc. in OrbitRing3D
                                are defined relative to the brain's own local
                                space, a uniform scale here preserves exactly the
                                same icon-to-brain gap, just bigger, rather than
                                needing to separately recompute icon distances. */}
                            <group scale={1.28} position={[0, -0.1, 0]}>
                                <BrainSystem3D onPulseReady={setPulseLines} />
                                <OrbitRing3D
                                    onHoverPointsReady={setHoverPoints}
                                    onModuleClick={handleModuleClick}
                                    activeModuleId={activeModuleId}
                                />
                            </group>
                            <GlowLayer selection={[...pulseLines, ...hoverPoints]} lights={[ambientLight]} />
                        </Canvas>
                    </div>
                    <div className="brain-voice-bar-row">
                        <VoiceBar />
                    </div>
                </div>

                <aside className="side-widget-column">
                    {rightWidgets.map((w) => (
                        <Widget
                            key={w.id}
                            definition={w}
                            onClick={(e) => handleWidgetClick(w, anchorFromEvent(e), w.body)}
                        />
                    ))}
                </aside>
            </div>

            <DetailDrawer content={detail} onClose={closeDetail} />
        </div>
    );
}
