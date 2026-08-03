import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AmbientLight, type Line } from "three";
import BrainSystem3D from "./BrainSystem3D";
import GlowLayer from "./GlowLayer";
import OrbitRing3D from "./OrbitRing3D";
import TopBar from "./TopBar";
import Widget from "../widget/Widget";
import { leftWidgets, rightWidgets } from "./sceneWidgets";
import milkyWayPhoto from "../../assets/milky-way-background.jpg";

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
 * Layout is a first pass at the real KIWI HQ 3-column grid (see
 * Dashboard.css's .hq-grid) rather than the brain filling the full
 * viewport width — a TopBar (brand mark, the "Hey Kiwi" voice bar, and a
 * login/status placeholder) sits above everything, and left/right widget
 * columns sit beside the Canvas below it (R3F auto-resizes the
 * camera/canvas to its narrower container, no manual math needed). All
 * widgets live in those two columns now — no below-the-fold row. This is
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
 * onReady, threaded through BrainSystem3D) AND the icons' hover-pulse
 * Line objects (via OrbitRing3D's onHoverLinesReady) are lifted up here
 * and merged into one selection, purely so GlowLayer's SelectiveBloom
 * can target exactly those objects — see GlowLayer's doc comment for why
 * a plain global-threshold Bloom couldn't do this.
 */
export default function BrainScene3D() {
    const ambientLight = useMemo(() => new AmbientLight(0xffffff, 0.5), []);
    const [pulseLines, setPulseLines] = useState<Line[]>([]);
    const [hoverLines, setHoverLines] = useState<Line[]>([]);

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
            <TopBar />

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: "1fr 2.6fr 1fr",
                    gap: 24,
                    padding: "12px 32px 32px",
                    boxSizing: "border-box",
                }}
            >
                <aside style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", justifyContent: "center" }}>
                    {leftWidgets.map((w) => (
                        <Widget key={w.id} definition={w} />
                    ))}
                </aside>

                <div style={{ position: "relative", height: "100%" }}>
                    <Canvas camera={{ position: [0, 0, 4], fov: 50 }} gl={{ alpha: true }}>
                        <primitive object={ambientLight} />
                        <BrainSystem3D onPulseReady={setPulseLines} />
                        <OrbitRing3D onHoverLinesReady={setHoverLines} />
                        <GlowLayer selection={[...pulseLines, ...hoverLines]} lights={[ambientLight]} />
                    </Canvas>
                </div>

                <aside style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", justifyContent: "center" }}>
                    {rightWidgets.map((w) => (
                        <Widget key={w.id} definition={w} />
                    ))}
                </aside>
            </div>
        </div>
    );
}
