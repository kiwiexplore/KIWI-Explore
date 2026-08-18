import { useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { BackSide, Matrix4, Vector3, type Group, type Line } from "three";
import NeuronLayer from "./NeuronLayer";
import ConnectionLayer from "./ConnectionLayer";
import EnergyLayer from "./EnergyLayer";
import BrainHaze from "./BrainHaze";


// Radius of the invisible pointer hit-sphere below, in the brain's own
// local space — wider than the point cloud itself so there's a generous
// area to grab and click on.
const HIT_SPHERE_RADIUS = 1.1;

const localPoint = new Vector3();
const localCamera = new Vector3();
const localRayDirection = new Vector3();
const inverseWorld = new Matrix4();

interface BrainSystemProps {
    // Forwarded straight to EnergyLayer — see its own prop doc. Threaded
    // through here because GlowLayer (which needs these objects for
    // SelectiveBloom) is a sibling of this whole group, not a descendant.
    onPulseReady?: (lines: Line[]) => void;
    // Whether dragging directly on the brain manually rotates it — on
    // by default (the Dashboard's own big brain). Off for the small
    // Laboratory KIWI Core badge (see KiwiCoreBadge), where there's no
    // room/reason for that interaction — this skips rendering the
    // invisible hit-sphere entirely, rather than just ignoring drags,
    // so it doesn't eat pointer events meant for whatever sits near it
    // (e.g. the "Dashboard" back button).
    interactive?: boolean;
    // Passed down to NeuronLayer, which lights the focused/hovered
    // region's own neurons and dims the rest.
    focusRegionId?: string | null;
    hoverRegionId?: string | null;
    // A click on the brain, reported as a direction in its own local
    // space — BrainScene3D resolves it to a region (see
    // regionAtLocalDirection). With the per-region markers gone, this is
    // the only way a region gets picked in the 3D scene at all.
    onPickDirection?: (direction: [number, number, number]) => void;
    // Same thing for plain hovering — reported continuously while the
    // pointer moves over the brain (null when it leaves), so the area
    // under the cursor can brighten. Replaces the hover handling that
    // used to sit on the per-region marker meshes.
    onHoverDirection?: (direction: [number, number, number] | null) => void;
    // Whether the pointer was just dragged across the scene. Dragging is
    // caught at the DOM level now, anywhere on screen (see
    // BrainScene3D), so this surface has to ask before treating a
    // release as a click — otherwise letting go after turning the view
    // would also open whatever region ended up under the cursor.
    wasDragged?: () => boolean;
    // Rendered inside the brain's own group — the region name labels
    // (BrainRegionLabels) and the fact pins go here, so they stay glued
    // to their anatomical spots.
    children?: ReactNode;
}

/**
 * Combines the three Brain layers (neurons, connections, energy impulses)
 * into one breathing group. GlowLayer is deliberately NOT included here —
 * bloom is a postprocessing pass on the whole Canvas, not something that
 * belongs inside an individual object's group, so it lives as a sibling
 * in BrainScene3D instead.
 *
 * The brain holds still. Dragging is reported upward (onLook) and moves
 * the CAMERA — orbiting it around the brain from outside, turning it on
 * the spot from within a region. An earlier version spun the brain under
 * a fixed camera, which reads as a model on a turntable rather than as a
 * place you're moving through, and it also meant everything anchored to
 * the brain swung about with it.
 *
 * The invisible hit-sphere below is the brain's hover and click
 * surface: moving over it reports which area is under the cursor (so
 * that section brightens), and a press that wasn't a drag reports where
 * you clicked, which is how an area of the brain pulls up that area.
 * Dragging is deliberately NOT handled here — a drag anywhere on the
 * screen turns the view (see BrainScene3D), so you never have to find
 * the brain first just to look around.
 */
export default function BrainSystem({
    onPulseReady,
    interactive = true,
    focusRegionId,
    hoverRegionId,
    onPickDirection,
    onHoverDirection,
    wasDragged,
    children,
}: BrainSystemProps) {
    const groupRef = useRef<Group>(null);

    useFrame((state) => {
        if (groupRef.current) {
            // The brain no longer turns at all: the CAMERA orbits it
            // instead (see BrainScene3D's rig), which is the difference
            // between walking around an object and watching one spin on
            // a turntable. All that's left here is the slow breath.
            const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
            groupRef.current.scale.setScalar(breathe);
        }
    });

    // Where on the brain a pointer event landed, as a direction in the
    // brain's own local space. The hit sphere renders BackSide (see the
    // mesh below), so the reported hit point is where the ray EXITS — on
    // the far side of the brain, i.e. the region you're looking through,
    // not the one under the cursor. Reflect it back to the entry point:
    // for a sphere centered on the group's own origin,
    // near = far - 2(far·dir)dir.
    const pickDirection = (event: ThreeEvent<PointerEvent | MouseEvent>): [number, number, number] | null => {
        if (!groupRef.current) return null;
        localPoint.copy(event.point);
        groupRef.current.worldToLocal(localPoint);
        inverseWorld.copy(groupRef.current.matrixWorld).invert();
        localRayDirection.copy(event.ray.direction).transformDirection(inverseWorld).normalize();

        // ...unless the camera is INSIDE the sphere, which it is whenever
        // a region is open (see BrainScene3D's CAMERA_Z_FOCUSED). From in
        // there the ray only ever leaves, so the exit point IS the wall
        // being pointed at — reflecting it would hand back the region
        // behind the viewer's head instead.
        localCamera.copy(event.ray.origin);
        groupRef.current.worldToLocal(localCamera);
        if (localCamera.length() >= HIT_SPHERE_RADIUS) {
            localPoint.addScaledVector(localRayDirection, -2 * localPoint.dot(localRayDirection));
        }
        // Only the DIRECTION is meaningful — the sphere is wider than the
        // brain, which is exactly what regionAtLocalDirection matches on.
        return [localPoint.x, localPoint.y, localPoint.z];
    };

    // Report which region the cursor is over, so that section of the
    // brain can brighten under it. Turning the view is the DOM layer's
    // job — this surface only ever answers "what am I pointing at".
    const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
        onHoverDirection?.(pickDirection(event));
    };

    const handlePointerOut = () => {
        onHoverDirection?.(null);
    };

    const handleClick = (event: ThreeEvent<MouseEvent>) => {
        if (!onPickDirection || wasDragged?.()) return;
        const direction = pickDirection(event);
        if (!direction) return;
        event.stopPropagation();
        onPickDirection(direction);
    };

    return (
        <group ref={groupRef}>
            <BrainHaze focusRegionId={focusRegionId} hoverRegionId={hoverRegionId} />
            <ConnectionLayer focusRegionId={focusRegionId} hoverRegionId={hoverRegionId} />
            <NeuronLayer focusRegionId={focusRegionId} hoverRegionId={hoverRegionId} />
            <EnergyLayer onReady={onPulseReady} focusRegionId={focusRegionId} />
            {children}
            {interactive && (
                <mesh
                    onPointerMove={handlePointerMove}
                    onPointerOut={handlePointerOut}
                    onClick={handleClick}
                >
                    <sphereGeometry args={[HIT_SPHERE_RADIUS, 16, 16]} />
                    {/* BackSide is load-bearing for interaction, not looks:
                        opening a region flies the camera INSIDE this
                        sphere, and a front-facing hit surface stops being
                        hit at all from in there — which would kill hover
                        and clicking exactly where the whole navigation
                        happens. Raycasting the inner face works from both
                        sides; pickDirection above is what sorts out which
                        of the two cases a hit came from. */}
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} side={BackSide} />
                </mesh>
            )}
        </group>
    );
}
