import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { AmbientLight, type Line, type Object3D } from "three";
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
import SpaceMissionsWidget from "./SpaceMissionsWidget";
import RecipesWidget from "./RecipesWidget";
import UpcomingEventsWidget from "./UpcomingEventsWidget";
import ProjectsWidget from "./ProjectsWidget";
import NotesWidget from "./NotesWidget";
import TopNewsWidget from "./TopNewsWidget";
import EntertainmentWidget from "./EntertainmentWidget";
import ChartWidget from "./ChartWidget";
import { leftWidgets, rightWidgets } from "./sceneWidgets";
import { orbitModules } from "../../state/orbitModules";
import { resolveBackgroundImage } from "../../state/backgrounds";
import { fetchTopSongs, fetchTopPodcasts } from "../../lib/itunes";
import type { AccountState } from "../../state/account";
import type { CalendarState } from "../../state/calendar";
import type { LaboratoryDataState } from "../../state/laboratoryData";
import type { SpotifyState } from "../../state/spotify";
import "./BrainScene3D.css";

// A uniform dark scrim over the whole photo (it was too bright/busy for
// the brain's thin cyan lines to read clearly against it), plus a soft
// edge vignette on top (transparent in the middle, darker at the very
// edges — NOT a centered bright-to-dark radial, which read as a glowing
// "bubble" behind the brain in an earlier procedural version). The photo
// itself is now the user's chosen background (see ProfileSettings).
function backgroundLayers(resolvedImage: string): string {
    return [
        "linear-gradient(rgba(0,0,0,0.32), rgba(0,0,0,0.32))",
        "radial-gradient(ellipse 140% 120% at 50% 50%, transparent 50%, rgba(0,0,0,0.35) 100%)",
        resolvedImage,
    ].join(", ");
}

function anchorFromEvent(event: MouseEvent<HTMLElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * The KIWI HQ dashboard — mounted directly as the app's root (see
 * App.tsx). Canvas, camera, lights, and the Brain itself (BrainSystem3D
 * = NeuronLayer + ConnectionLayer + EnergyLayer) plus GlowLayer
 * (SelectiveBloom) and the orbiting module icons. An earlier, simpler 2D
 * prototype dashboard (Sprint 001-003) lived at components/layout/ —
 * removed once this 3D version fully superseded it.
 *
 * No OrbitControls — the camera is fully static (fixed position/FOV, no
 * rotate/pan/zoom). Only BrainSystem3D itself rotates, driven by
 * dragging directly on the brain (see its own pointer handlers) or its
 * own idle auto-spin when not being dragged.
 *
 * Layout: a TopBar sits above everything, left/right widget columns
 * flank the brain Canvas (10 widgets each, scrolling vertically to fit —
 * see sceneWidgets.ts), with the voice bar below the brain.
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
 * onReady, threaded through BrainSystem3D) AND the icons' glow objects —
 * hover-glow Points plus brain-side flare Lines (via OrbitRing3D's
 * onGlowObjectsReady) — are lifted up here and merged into one
 * selection, purely so GlowLayer's SelectiveBloom can target exactly
 * those objects — see GlowLayer's doc comment for why a plain
 * global-threshold Bloom couldn't do this.
 *
 * Clicking a widget or an orbit icon opens DetailDrawer with that item's
 * full info, anchored right where the clicked thing is on screen —
 * deliberately not a fixed side panel or full-screen modal, so the brain
 * stays visible/"within reach" while it's open (see DetailDrawer's own
 * doc comment). Sign-in/profile use the exact same DetailDrawer, just
 * with a form or settings list as the body instead of widget text — see
 * handleSignInClick/handleProfileClick below. There's no real backend
 * behind any of this yet (see SignUpForm's own note) — `account`
 * (nickname/avatar/plan) is owned by App.tsx now, passed down as a
 * prop, so it survives switching to Laboratory and back.
 */
interface BrainScene3DProps {
    // Fired by TopBar's Space Laboratory icon — App.tsx swaps this whole
    // scene out for components/laboratory/Laboratory when set.
    onOpenLaboratory?: () => void;
    account: AccountState;
    calendar: CalendarState;
    // Same data Laboratory itself edits (state/laboratoryData.ts,
    // owned by App.tsx) — read-only here, just for the Projects/Notes
    // widgets below.
    laboratoryData: LaboratoryDataState;
    // Owned by App.tsx (state/spotify.ts) — shared with Laboratory so
    // the connection survives switching scenes (see that file's own
    // doc comment for why it can't just be local state here).
    spotify: SpotifyState;
}

export default function BrainScene3D({ onOpenLaboratory, account, calendar, laboratoryData, spotify }: BrainScene3DProps) {
    const { nickname, setNickname, avatar, activeIconIds, activeLeftWidgetIds, activeRightWidgetIds, background } = account;
    const ambientLight = useMemo(() => new AmbientLight(0xffffff, 0.5), []);
    const [pulseLines, setPulseLines] = useState<Line[]>([]);
    const [glowObjects, setGlowObjects] = useState<Object3D[]>([]);
    // Lifted from VoiceBar (see its own onListeningChange doc) so the
    // brain can pause its rotation and glow brighter while Hey Kiwi is
    // actively listening — both BrainSystem3D and GlowLayer are its
    // siblings here, not descendants, so this has to live up here.
    const [kiwiListening, setKiwiListening] = useState(false);
    const [detail, setDetail] = useState<DetailDrawerContent | null>(null);
    // Which orbit icon's drawer is open, if any — kept separate from
    // `detail` itself (which also covers widgets) so OrbitRing3D can use
    // it to keep that one icon's hover glow lit even once the mouse has
    // moved away, e.g. toward the drawer's content.
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    // The profile drawer's anchor only — its body is built fresh below
    // (not stored in `detail`), since it needs to keep reflecting
    // `account` state that changes *from inside itself* while it stays
    // open. Storing a pre-rendered <ProfileSettings/> node in
    // `detail.body` (like every other drawer here does) would freeze
    // those props at click-time: React bails out of re-rendering that
    // subtree on later parent state changes since the element
    // reference in state never changes, so the picker/plan cards would
    // silently go stale the moment you interact with them.
    const [profileAnchor, setProfileAnchor] = useState<{ x: number; y: number } | null>(null);

    const closeDetail = () => {
        setDetail(null);
        setActiveModuleId(null);
        setProfileAnchor(null);
    };

    const handleModuleClick = (moduleId: string, anchor: { x: number; y: number }) => {
        const module = orbitModules.find((m) => m.id === moduleId);
        if (!module) return;
        setActiveModuleId(moduleId);
        setProfileAnchor(null);
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
        setProfileAnchor(null);
        setDetail({ title: w.title, body, anchor });
    };

    // Shared by the live-data widgets (Weather, Space News) — they build
    // their own detail body (forecast/article list) internally, unlike
    // the placeholder widgets above whose body is just static text.
    const openDetail = (title: string, anchor: { x: number; y: number }, body: ReactNode, maxHeight?: number) => {
        setProfileAnchor(null);
        setDetail({ title, anchor, body, maxHeight });
    };

    const handleSignInClick = (event: MouseEvent<HTMLElement>) => {
        const anchor = anchorFromEvent(event);
        setProfileAnchor(null);
        setDetail({
            title: "Create your account",
            anchor,
            maxHeight: 520,
            body: <SignUpForm onSubmit={(name) => { setNickname(name); closeDetail(); }} />,
        });
    };

    const handleProfileClick = (event: MouseEvent<HTMLElement>) => {
        setDetail(null);
        setProfileAnchor(anchorFromEvent(event));
    };

    const handleInfoClick = (event: MouseEvent<HTMLElement>) => {
        const anchor = anchorFromEvent(event);
        setProfileAnchor(null);
        setDetail({
            title: "Info",
            anchor,
            width: 440,
            maxHeight: 700,
            body: <InfoPanel />,
        });
    };

    // Built fresh on every render (see profileAnchor's own comment) so
    // it always reflects the latest account state.
    const profileDetail: DetailDrawerContent | null = profileAnchor ? {
        title: "Profile & settings",
        anchor: profileAnchor,
        maxHeight: 620,
        body: <ProfileSettings account={account} onSignOut={() => { setNickname(null); closeDetail(); }} />,
    } : null;

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                backgroundColor: "#050816",
                backgroundImage: backgroundLayers(resolveBackgroundImage(background)),
                backgroundSize: "auto, auto, cover",
                backgroundPosition: "center, center, center",
                backgroundRepeat: "no-repeat, no-repeat, no-repeat",
                backgroundAttachment: "fixed, fixed, fixed",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <TopBar nickname={nickname} onSignInClick={handleSignInClick} onProfileClick={handleProfileClick} onInfoClick={handleInfoClick} onLaboratoryClick={onOpenLaboratory} avatar={avatar} spotify={spotify} />

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
                    {activeLeftWidgetIds
                        .map((id) => leftWidgets.find((w) => w.id === id))
                        .filter((w): w is (typeof leftWidgets)[number] => Boolean(w))
                        .map((w) => {
                            if (w.id === "weather") return <WeatherWidget key={w.id} onOpenDetail={openDetail} />;
                            if (w.id === "space-news") return <SpaceNewsWidget key={w.id} onOpenDetail={openDetail} />;
                            if (w.id === "space-missions") return <SpaceMissionsWidget key={w.id} onOpenDetail={openDetail} />;
                            if (w.id === "upcoming-events") return <UpcomingEventsWidget key={w.id} events={calendar.events} onOpenDetail={openDetail} />;
                            if (w.id === "top-news") return <TopNewsWidget key={w.id} onOpenDetail={openDetail} />;
                            if (w.id === "entertainment") return <EntertainmentWidget key={w.id} onOpenDetail={openDetail} />;
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
                            <group scale={0.96} position={[0, 0.14, 0]}>
                                <BrainSystem3D onPulseReady={setPulseLines} listening={kiwiListening} />
                                <OrbitRing3D
                                    onGlowObjectsReady={setGlowObjects}
                                    onModuleClick={handleModuleClick}
                                    activeModuleId={activeModuleId}
                                    activeIconIds={activeIconIds}
                                />
                            </group>
                            <GlowLayer selection={[...pulseLines, ...glowObjects]} lights={[ambientLight]} boosted={kiwiListening} />
                        </Canvas>
                    </div>
                    <div className="brain-voice-bar-row">
                        <VoiceBar onListeningChange={setKiwiListening} />
                    </div>
                </div>

                <aside className="side-widget-column">
                    {activeRightWidgetIds
                        .map((id) => rightWidgets.find((w) => w.id === id))
                        .filter((w): w is (typeof rightWidgets)[number] => Boolean(w))
                        .map((w) => {
                            if (w.id === "recipes") return <RecipesWidget key={w.id} onOpenDetail={openDetail} />;
                            if (w.id === "projects") return <ProjectsWidget key={w.id} projects={laboratoryData.projects} onOpenDetail={openDetail} />;
                            if (w.id === "notes") return <NotesWidget key={w.id} notes={laboratoryData.notes} onOpenDetail={openDetail} />;
                            if (w.id === "music") return <ChartWidget key={w.id} title="🎵 Music" fetchChart={fetchTopSongs} onOpenDetail={openDetail} />;
                            if (w.id === "podcasts") return <ChartWidget key={w.id} title="🎙️ Podcasts" fetchChart={fetchTopPodcasts} onOpenDetail={openDetail} />;
                            return (
                                <Widget
                                    key={w.id}
                                    definition={w}
                                    onClick={(e) => handleWidgetClick(w, anchorFromEvent(e), w.body)}
                                />
                            );
                        })}
                </aside>
            </div>

            <DetailDrawer content={profileDetail ?? detail} onClose={closeDetail} />
        </div>
    );
}
