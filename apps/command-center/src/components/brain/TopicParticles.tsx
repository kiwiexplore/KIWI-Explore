import { useMemo } from "react";
import { getDotTexture } from "./dotTexture";
import type { TopicNode } from "./topicTree";
import type { BrainRegionDefinition } from "../../state/brainRegions";

// One size per level, so depth in the tree reads as size on screen.
const SIZE = { region: 0.1, category: 0.058, story: 0.03 } as const;
// How much a particle dims when it isn't part of the level you're on.
// Not to nothing: they stay visible, because the point is that the
// brain is holding all of it whichever level you happen to be at.
const RESTING = 0.34;

interface TopicParticlesProps {
    region: BrainRegionDefinition | null;
    nodes: TopicNode[];
    /** The open topic, whose own stories are the live ones. */
    openModuleId: string | null;
    /** The open story, brightest of all. */
    openStoryId: string | null;
}

/**
 * The open region's contents, as particles in the brain.
 *
 * One particle per thing it holds — the area, each topic, each story
 * (see topicTree) — so the brain visibly carries as much as there is,
 * and carries less when there's less. They're all present at every
 * level; what changes is which ones are lit and which sit back, and
 * which are named at all (RegionDataPins draws those labels).
 *
 * Each story is tethered to the topic it belongs to and each topic to
 * the area, so what belongs to what is visible rather than implied.
 *
 * Three separate <points> rather than one with per-vertex sizes: three
 * materials is the whole cost of it, and it avoids a custom shader for
 * what is really just three constants.
 */
export default function TopicParticles({ region, nodes, openModuleId, openStoryId }: TopicParticlesProps) {
    const layers = useMemo(() => {
        if (!region) return null;

        const [r, g, b] = region.rgb;
        const levels: TopicLevelBuffers = { region: blank(), category: blank(), story: blank() };
        const tethers: number[] = [];

        nodes.forEach((node) => {
            // Lit if it's what you're looking at, or the path to it.
            const live = node.level === "region"
                || (node.level === "category" && (!openModuleId || node.moduleId === openModuleId))
                || (node.level === "story" && node.moduleId === openModuleId);
            const focused = node.storyId !== undefined && node.storyId === openStoryId;
            const strength = focused ? 1.6 : live ? 1 : RESTING;

            const bucket = levels[node.level];
            bucket.positions.push(...node.position);
            bucket.colors.push(r * strength, g * strength, b * strength);

            if (node.parent) tethers.push(...node.position, ...node.parent);
        });

        return { levels, tethers: new Float32Array(tethers) };
    }, [region, nodes, openModuleId, openStoryId]);

    if (!region || !layers) return null;

    return (
        <group>
            {(["region", "category", "story"] as const).map((level) => {
                const bucket = layers.levels[level];
                if (bucket.positions.length === 0) return null;
                return (
                    <points key={level}>
                        <bufferGeometry>
                            <bufferAttribute attach="attributes-position" args={[new Float32Array(bucket.positions), 3]} />
                            <bufferAttribute attach="attributes-color" args={[new Float32Array(bucket.colors), 3]} />
                        </bufferGeometry>
                        <pointsMaterial
                            vertexColors
                            map={getDotTexture()}
                            alphaTest={0.05}
                            size={SIZE[level]}
                            sizeAttenuation
                            transparent
                            depthWrite={false}
                        />
                    </points>
                );
            })}

            {layers.tethers.length > 0 && (
                <lineSegments>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[layers.tethers, 3]} />
                    </bufferGeometry>
                    {/* Faint on purpose: this says what hangs off what,
                        and shouldn't compete with the brain's own
                        wiring behind it. */}
                    <lineBasicMaterial color={region.color} transparent opacity={0.16} depthWrite={false} />
                </lineSegments>
            )}
        </group>
    );
}

interface LevelBuffer { positions: number[]; colors: number[] }
type TopicLevelBuffers = Record<"region" | "category" | "story", LevelBuffer>;

function blank(): LevelBuffer {
    return { positions: [], colors: [] };
}
