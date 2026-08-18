import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Vector3, type Group } from "three";
import { regionPins } from "./regionPins";
import type { RegionFact } from "./regionContent/regionFacts";
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
    facts: RegionFact[];
    /**
     * Opens what the pin is about: its module in the region panel, and
     * — for a pin that stands for one story rather than for a module as
     * a whole — that story's own page inside it.
     */
    onOpenFact: (fact: RegionFact) => void;
}

/**
 * The open region's own information, pinned onto its own neurons.
 *
 * Each pin is a real fact from that area's live data (see regionFacts)
 * sitting on a real neuron of that region, and each one is a button:
 * clicking it opens the module that fact came from in the region panel,
 * so a headline on the wall takes you straight to the news list rather
 * than being scenery.
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
export default function RegionDataPins({ region, facts, onOpenFact }: RegionDataPinsProps) {
    // Each fact is pinned at ITS OWN module's spot in the region, which
    // is the same spot the camera turns to when it's opened — see
    // regionPins, which is shared with the camera for exactly that
    // reason.
    const pins = useMemo(() => regionPins(region, facts), [region, facts]);
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
            {pins.map(({ fact, position }, index) => {
                return (
                    <group key={index} position={position} ref={(node) => { groupRefs.current[index] = node; }}>
                        <Html center zIndexRange={[2, 0]}>
                            <button
                                type="button"
                                ref={(node) => { pinRefs.current[index] = node; }}
                                className="region-pin"
                                style={{ borderColor: region.color, color: region.color }}
                                // Both handlers stop here: without this the
                                // press also reaches the brain's own hit
                                // sphere behind the label, which resolves it
                                // to whatever region lies that way and throws
                                // you out of the one you're reading.
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onOpenFact(fact);
                                }}
                            >
                                <span className="region-pin-dot" style={{ background: region.color }} />
                                <span className="region-pin-text">{fact.text}</span>
                            </button>
                        </Html>
                    </group>
                );
            })}
        </group>
    );
}
