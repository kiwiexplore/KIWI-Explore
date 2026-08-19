import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ShaderMaterial } from "three";
import { connectionPositions, connectionColors, connectionRegions } from "./connectionGeometry";
import { brainRegions } from "../../state/brainRegions";

// How the web reacts when one region is hovered or open: that region's
// own lines come up, everything else drops well back. The drop is the
// important half — separation reads far better as "the rest recedes"
// than as "this one glows", and the whole point is that the chosen area
// is unmistakably in front of the others.
const LIT_GAIN = 1.4;
const UNLIT_DIM = 0.32;
const UNLIT_FADE = 0.45;
const FADE_SPEED = 4.5;

// Base opacity of the web, and how far it's pulled back while a region
// is open (the camera is inside the brain then, and at that range the
// full-strength web crowds out everything else).
const BASE_OPACITY = 0.4;
const FOCUSED_OPACITY = 0.28;
// Resting brightness and opacity, with nothing hovered or open. The
// highlight blends from these to the values above, so hovering lands
// exactly where it did before — only the idle state sits back.
const IDLE_BRIGHTNESS = 0.68;
const IDLE_FADE = 0.78;

const vertexShader = /* glsl */ `
    attribute vec3 aColor;
    attribute float aRegion;

    uniform float uLitRegion;
    uniform float uHighlight;
    uniform float uOpacity;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        float lit = step(0.0, aRegion) * (1.0 - step(0.5, abs(aRegion - uLitRegion)));

        float brightness = mix(${IDLE_BRIGHTNESS.toFixed(2)}, mix(${UNLIT_DIM.toFixed(2)}, ${LIT_GAIN.toFixed(2)}, lit), uHighlight);
        float alpha = mix(${IDLE_FADE.toFixed(2)}, mix(${UNLIT_FADE.toFixed(2)}, 1.0, lit), uHighlight);

        vColor = aColor * brightness;
        vAlpha = uOpacity * alpha;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        gl_FragColor = vec4(vColor, vAlpha);
    }
`;

// Built once at module scope, not per mount: there is exactly one brain
// in this app, the whole web is a single shared buffer already (see
// connectionGeometry), and a material created inside the component would
// be a local that useFrame then mutates every frame — which is both
// pointless churn and something React's lint rules rightly object to.
const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        uLitRegion: { value: -1 },
        uHighlight: { value: 0 },
        uOpacity: { value: BASE_OPACITY },
    },
    transparent: true,
    depthWrite: false,
});

interface ConnectionLayerProps {
    focusRegionId?: string | null;
    hoverRegionId?: string | null;
}

/**
 * Renders the neural connections — each one a bent 3-point polyline (see
 * state/neuralNetwork3D.ts), not a straight line, so the network doesn't
 * read as a geometric wireframe/triangulation. Flattened into a single
 * LineSegments buffer (one draw call) rather than one <line> per
 * connection, which would be far more expensive and also hit the
 * <line>-vs-SVGLineElement JSX typing collision documented in
 * EnergyLayer.tsx.
 *
 * The vertex data (baked + synthetic gap-fill + fissure seam + the long
 * tracts that cross the interior) is built once in connectionGeometry.ts,
 * along with a per-vertex colour and the region each vertex belongs to.
 *
 * Both of those are what make the areas readable. The colour tells them
 * apart at rest; the region index lets the shader lift ONE region's web
 * and push every other one back when it's hovered or open. A plain
 * material can't do the second part at all — the whole web is a single
 * buffer with one colour and one opacity, so before this it could only
 * be dimmed as a whole, which is why a hovered area never really stood
 * out from its neighbours.
 */
export default function ConnectionLayer({ focusRegionId, hoverRegionId }: ConnectionLayerProps) {
    const highlight = useRef(0);
    const litRegion = useRef(-1);

    useFrame((_, delta) => {
        const targetId = focusRegionId ?? hoverRegionId ?? null;
        const targetRegion = targetId ? brainRegions.findIndex((region) => region.id === targetId) : -1;
        if (targetRegion >= 0) litRegion.current = targetRegion;

        const step = Math.min(1, delta * FADE_SPEED);
        highlight.current += ((targetRegion >= 0 ? 1 : 0) - highlight.current) * step;
        if (highlight.current < 0.002) highlight.current = 0;

        material.uniforms.uLitRegion.value = litRegion.current;
        material.uniforms.uHighlight.value = highlight.current;
        material.uniforms.uOpacity.value = focusRegionId ? FOCUSED_OPACITY : BASE_OPACITY;
    });

    return (
        <lineSegments material={material}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[connectionPositions, 3]} />
                <bufferAttribute attach="attributes-aColor" args={[connectionColors, 3]} />
                <bufferAttribute attach="attributes-aRegion" args={[connectionRegions, 1]} />
            </bufferGeometry>
        </lineSegments>
    );
}
