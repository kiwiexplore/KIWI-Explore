import type { Object3D } from "three";
import { EffectComposer, SelectiveBloom } from "@react-three/postprocessing";

interface GlowLayerProps {
    // The energy pulse Line objects (from EnergyLayer, via BrainSystem3D)
    // and the light(s) SelectiveBloom needs to render its isolated pass.
    selection: Object3D[];
    lights: Object3D[];
    // True while Hey Kiwi is actively listening — bumps bloom intensity
    // up so the brain visibly "lights up more" while it's paying
    // attention, alongside BrainSystem3D pausing its rotation for the
    // same reason. Back to BASE_INTENSITY the moment listening stops.
    boosted?: boolean;
}

const BASE_INTENSITY = 3.6;
const BOOSTED_INTENSITY = 6.2;

/**
 * Bloom postprocessing on its own — split out from BrainScene3D so it's a
 * clearly separate concern, per the layered architecture (Neuron/
 * Connection/Energy/Glow).
 *
 * Uses SelectiveBloom, not a plain luminance-threshold Bloom — a global
 * threshold couldn't cleanly separate "bright ambient neuron" from "energy
 * pulse" (their color ranges genuinely overlap), so glow kept showing up
 * on the static network instead of only where a pulse had actually passed.
 * SelectiveBloom sidesteps that entirely: only objects in `selection`
 * (the pulse lines) are eligible to glow at all, regardless of how bright
 * anything else in the scene is. Since ambient neurons can never bloom
 * either way, luminanceThreshold is kept low here — it only needs to
 * shape *how much* of a given pulse glows, not protect the rest of the
 * brain. A higher threshold meant only the brightest (near-white/cyan)
 * pulses ever cleared it, so darker hues like purple never visibly
 * bloomed at all — a low threshold makes every hue glow reliably.
 *
 * `radius` (only applies to mipmap blur, which stays on) is turned down
 * from its default — the default spreads the blur very wide, and since
 * the pulse lines are scattered all through the brain's volume, that
 * spread merged into one big soft halo sized like the whole brain ("a
 * glowing bubble around it") rather than a tight glow hugging each pulse.
 *
 * `multisampling={0}` on EffectComposer: SelectiveBloomEffect renders its
 * own internal depth pass to isolate the selection, and with MSAA
 * (the default here is 8) that combination threw a continuous stream of
 * `glBlitFramebuffer` "read and write depth stencil attachments cannot
 * be the same image" WebGL errors — which silently broke rendering for
 * long stretches. Disabling multisampling on the composer avoids the
 * conflict; not a visible quality loss since none of this scene relies
 * on MSAA edge smoothing to look right (points/lines, not polygon edges).
 */
export default function GlowLayer({ selection, lights, boosted }: GlowLayerProps) {
    return (
        <EffectComposer multisampling={0}>
            <SelectiveBloom
                selection={selection}
                lights={lights}
                intensity={boosted ? BOOSTED_INTENSITY : BASE_INTENSITY}
                luminanceThreshold={0.05}
                luminanceSmoothing={0.4}
                mipmapBlur
                radius={0.18}
            />
        </EffectComposer>
    );
}
