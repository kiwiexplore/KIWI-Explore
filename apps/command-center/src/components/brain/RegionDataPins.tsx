import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Vector3, type Group } from "three";
import { namedNodes, type TopicNode } from "./topicTree";
import type { BrainRegionDefinition } from "../../state/brainRegions";
import "./RegionDataPins.css";

// A pin whose direction from the camera is further off-axis than this is
// hidden: with the camera inside the brain, a pin can easily end up
// behind the viewer, and drei projects those back onto the screen
// mirrored — a label floating over the wrong part of the scene.
const AHEAD_CUTOFF = 0.35;

const pinWorld = new Vector3();
const cameraForward = new Vector3();
const toPin = new Vector3();

interface RegionDataPinsProps {
    /** The open region, or null for the whole-brain view (no pins). */
    region: BrainRegionDefinition | null;
    /** Everything the region holds, at every level — see topicTree. */
    nodes: TopicNode[];
    /** Null at the region's own level; a module id once one is open. */
    openModuleId: string | null;
    /** Opens what the pin stands for: a topic, or one story inside it. */
    onOpenNode: (node: TopicNode) => void;
    /**
     * Whether the pointer moved between press and release. A drag that
     * happens to finish over a pin was someone turning the view, not
     * choosing a story — see the click handler.
     */
    wasDragged: () => boolean;
}

/**
 * The open region's own information, pinned onto its own neurons.
 *
 * Each pin sits on the particle it names (see topicTree) and each one
 * is a button: clicking a topic opens it, clicking a headline opens
 * that story — so what's written on the wall takes you straight there
 * rather than being scenery.
 *
 * Only ONE level is named at a time. The particles for everything else
 * are still there (TopicParticles draws them); they simply aren't
 * shouting.
 *
 * An earlier version had these labels flying along the connections. They
 * were replaced with fixed pins per explicit request — moving text is
 * hard to read and impossible to aim at, and a fact you can't click is a
 * dead end.
 *
 * Rendered as a child of the rotating brain group, so each pin stays on
 * its own neuron as the brain turns. The component itself stays mounted
 * with no region open (rendering nothing) rather than being mounted and
 * unmounted around it: its useFrame is what hides pins that end up
 * behind the camera, and that has to be subscribed from the start.
 */
export default function RegionDataPins({ region, nodes, openModuleId, onOpenNode, wasDragged }: RegionDataPinsProps) {
    // ONE level at a time: the region's topics until you open one, then
    // that topic's stories (see namedNodes). Every particle stays in
    // place either way — TopicParticles draws all of them — but naming
    // them all at once put thirty labels over one wall, which is the
    // thing this now doesn't do.
    const pins = useMemo(() => namedNodes(nodes, openModuleId), [nodes, openModuleId]);
    const groupRefs = useRef<(Group | null)[]>([]);
    const pinRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // One loop for every pin rather than a useFrame inside each: the pins
    // come and go with the open region, and this way the subscription
    // belongs to a component that's always there.
    useFrame((state) => {
        state.camera.getWorldDirection(cameraForward);

        for (let i = 0; i < pins.length; i++) {
            const group = groupRefs.current[i];
            const pin = pinRefs.current[i];
            if (!group || !pin) continue;

            group.getWorldPosition(pinWorld);
            toPin.copy(pinWorld).sub(state.camera.position).normalize();
            pin.style.display = toPin.dot(cameraForward) > AHEAD_CUTOFF ? "" : "none";
        }
    });

    if (!region) return null;

    return (
        <group>
            {pins.map((node, index) => {
                const { position } = node;
                return (
                    <group key={node.id} position={position} ref={(group) => { groupRefs.current[index] = group; }}>
                        <Html center zIndexRange={[2, 0]}>
                            <button
                                type="button"
                                ref={(node) => { pinRefs.current[index] = node; }}
                                className="region-pin"
                                style={{ borderColor: region.color, color: region.color }}
                                // The press deliberately does NOT stop here.
                                // It used to, and that quietly broke turning
                                // the view: a drag beginning over a pin never
                                // reached the scene's own handler, so the
                                // scene sat still and then opened whatever
                                // the finger happened to come up on. With
                                // twenty pins on a wall that's most of the
                                // screen. The press goes through; the CLICK
                                // is what's guarded.
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (wasDragged()) return;
                                    onOpenNode(node);
                                }}
                            >
                                <span className="region-pin-dot" style={{ background: region.color }} />
                                <span className="region-pin-text">{node.label}</span>
                            </button>
                        </Html>
                    </group>
                );
            })}
        </group>
    );
}
