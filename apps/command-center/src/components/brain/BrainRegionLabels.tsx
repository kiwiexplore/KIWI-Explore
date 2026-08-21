import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Vector3, type Group } from "three";
import { brainRegions, type BrainRegionDefinition } from "../../state/brainRegions";
import "./BrainRegionLabels.css";

// Labels float just off the surface point their region is anchored to.
const LABEL_LIFT = 1.06;
// Below this camera-facing dot product the label belongs to a region on
// the far side of the brain and is dropped entirely — otherwise the back
// three would float over the front, naming areas that aren't there.
// Only applies while the camera is OUTSIDE the brain: from inside there's
// nothing between the viewer and the far wall, so everything ahead is
// legitimately visible.
const FACING_CUTOFF = -0.05;
// Labels behind the viewer are dropped too — drei's <Html> happily
// projects a point that's behind the camera, which lands it back on
// screen mirrored, as a name stuck to the wrong wall.
const AHEAD_CUTOFF = 0.15;

const cameraDirection = new Vector3();
const cameraForward = new Vector3();
const labelDirection = new Vector3();
const toLabel = new Vector3();
const labelPosition = new Vector3();
const brainCenter = new Vector3();

interface RegionLabelProps {
    region: BrainRegionDefinition;
    hovered: boolean;
    onSelect: (regionId: string) => void;
    onHover: (regionId: string | null) => void;
    wasDragged: () => boolean;
}

function RegionLabel({ region, hovered, onSelect, onHover, wasDragged }: RegionLabelProps) {
    const groupRef = useRef<Group>(null);
    const front = useRef(true);
    // Mirrored into state only to mount/unmount the DOM label — a drei
    // <Html> keeps rendering its div even when its parent group is
    // invisible, so hiding the group isn't enough on its own.
    const [visible, setVisible] = useState(true);

    useFrame((state) => {
        const group = groupRef.current;
        if (!group) return;

        // Direction from the brain's own center out to this label, in
        // world space (so the group's live rotation is accounted for),
        // against the direction the camera is looking from.
        group.parent?.getWorldPosition(brainCenter);
        group.getWorldPosition(labelPosition);
        labelDirection.copy(labelPosition).sub(brainCenter).normalize();
        cameraDirection.copy(state.camera.position).sub(brainCenter);

        // Inside the brain (a region is open — see BrainScene3D) the
        // occlusion test above is meaningless: every wall is "far side"
        // from in there. What matters then is only whether the label is
        // ahead of the viewer.
        const inside = cameraDirection.length() < labelPosition.distanceTo(brainCenter);
        cameraDirection.normalize();
        state.camera.getWorldDirection(cameraForward);
        toLabel.copy(labelPosition).sub(state.camera.position).normalize();

        const ahead = toLabel.dot(cameraForward) > AHEAD_CUTOFF;
        const isFront = ahead && (inside || labelDirection.dot(cameraDirection) > FACING_CUTOFF);
        if (isFront !== front.current) {
            front.current = isFront;
            setVisible(isFront);
        }
    });

    return (
        <group
            ref={groupRef}
            position={[region.anchor[0] * LABEL_LIFT, region.anchor[1] * LABEL_LIFT, region.anchor[2] * LABEL_LIFT]}
        >
            {/* No distanceFactor on the <Html> on purpose: the labels keep
                a constant screen size instead of scaling with distance.
                Opening a region flies the camera deep into the brain, and
                scaled labels blew up to fill half the screen at that
                range. */}
            {visible && (
                <Html center zIndexRange={[3, 0]}>
                    <button
                        type="button"
                        className={`region-label${hovered ? " region-label-hovered" : ""}`}
                        // The press passes through so a drag that starts
                        // on a label still turns the view; only the click
                        // stops here, and only when it WAS a click.
                        onClick={(event) => {
                            event.stopPropagation();
                            if (wasDragged()) return;
                            onSelect(region.id);
                        }}
                        onMouseEnter={() => onHover(region.id)}
                        onMouseLeave={() => onHover(null)}
                    >
                        <span className="region-label-icon">{region.icon}</span>
                        <span style={{ color: region.color }}>{region.domain}</span>
                    </button>
                </Html>
            )}
        </group>
    );
}

interface BrainRegionLabelsProps {
    activeRegionId: string | null;
    hoverRegionId: string | null;
    onSelect: (regionId: string) => void;
    onHover: (regionId: string | null) => void;
    wasDragged: () => boolean;
}

/**
 * Names the brain's areas, and nothing more. There is deliberately no
 * marker, ring or glow sprite here any more (both were removed per
 * explicit request — they read as an effect pasted on top of the brain):
 * what tells the regions apart is the brain's own coloring, since every
 * region's neurons carry its color permanently (see NeuronLayer), and
 * hovering one simply brightens that section.
 *
 * The labels are also the reliable way to PICK a region. Clicking the
 * brain itself works by direction (see BrainSystem3D and
 * regionAtLocalDirection), and from any one viewpoint the top and bottom
 * regions are foreshortened into a thin band at the edge of the
 * silhouette — geometrically correct, and almost impossible to hit. The
 * label always sits over its own region at a comfortable size, so every
 * region has one target that behaves the same as every other.
 *
 * The open region's own label is left out entirely (see the map below).
 *
 * Rendered as a child of BrainSystem3D's rotating group (passed in as
 * children by BrainScene3D), which keeps each label glued to its own
 * anatomical spot through every rotation.
 */
export default function BrainRegionLabels({ activeRegionId, hoverRegionId, onSelect, onHover, wasDragged }: BrainRegionLabelsProps) {
    return (
        <group>
            {brainRegions.map((region) => (
                // The region you're standing IN doesn't name itself. Its
                // name is already on the panel and on the dial, and from
                // inside the label sits square in the middle of the wall
                // you came to read — over the very pins the region flew
                // you in to see. The other five stay: from in here they
                // are how you get anywhere else.
                region.id === activeRegionId ? null : (
                    <RegionLabel
                        key={region.id}
                        region={region}
                        hovered={region.id === hoverRegionId}
                        onSelect={onSelect}
                        onHover={onHover}
                        wasDragged={wasDragged}
                    />
                )
            ))}
        </group>
    );
}
