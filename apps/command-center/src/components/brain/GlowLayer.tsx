import { EffectComposer, Bloom } from "@react-three/postprocessing";

/**
 * Bloom postprocessing on its own — this is what turns "bright dots" into
 * "glowing dots" (re-blurs anything above a brightness threshold and adds
 * it back on top), so material colors can stay fairly modest; the glow
 * comes from this pass, not from cranking brightness values everywhere
 * else. Split out from BrainScene3D so it's a clearly separate concern,
 * per the layered architecture (Neuron/Connection/Energy/Glow).
 */
export default function GlowLayer() {
    return (
        <EffectComposer>
            <Bloom
                intensity={1.4}
                luminanceThreshold={0.15}
                luminanceSmoothing={0.9}
                mipmapBlur
            />
        </EffectComposer>
    );
}