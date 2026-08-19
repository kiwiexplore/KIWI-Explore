import {
    useCallback, useEffect, useMemo, useRef, useState,
    type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AmbientLight, Vector3, type Line, type PerspectiveCamera } from "three";
import BrainSystem3D from "./BrainSystem3D";
import BrainRegionLabels from "./BrainRegionLabels";
import RegionDataPins from "./RegionDataPins";
import BrainNavPanel from "./BrainNavPanel";
import BrainMiniMap from "./BrainMiniMap";
import BrainRegionPanel from "./BrainRegionPanel";
import GlowLayer from "./GlowLayer";
import SpaceBackdrop from "./SpaceBackdrop";
import { MOON_POSITION, MOON_RADIUS } from "./moonPlacement";
import TopBar from "./TopBar";
import VoiceBar from "./VoiceBar";
import DetailDrawer, { type DetailDrawerContent } from "../ui/DetailDrawer";
import InfoPanel from "../ui/InfoPanel";
import { findBrainRegion, regionAtLocalDirection } from "../../state/brainRegions";
import { regionSites } from "./regionSites";
import { regionPins } from "./regionPins";
import type { RegionFact } from "./regionContent/regionFacts";
import { useRegionFacts } from "./regionContent/regionFacts";
import type { CalendarState } from "../../state/calendar";
import type { LaboratoryDataState } from "../../state/laboratoryData";
import type { SpotifyState } from "../../state/spotify";
import "./BrainScene3D.css";

// The brain is the whole screen now (see the doc comment) — this scale
// plus the camera distance below is what fills it: the brain's own point
// cloud is ~1.7 units tall, so at 1.5x it covers roughly three quarters
// of the viewport's height with the top bar and voice bar clear of it.
const BRAIN_SCALE = 1.5;
// Far enough back that the WHOLE brain — including the top of the
// parietal lobe and the stem below — sits well inside the frame with
// room to spare. Closer in, those two ran off the top and bottom edges
// (and under the top bar and the voice bar), so they were the two
// regions you couldn't click on the brain itself.
const CAMERA_Z = 4.7;
// The whole orbit is nudged sideways so the brain sits right of centre,
// balancing the nav rail on the left. Applied to the orbit's own centre
// rather than by rotating the camera, so the brain never skews.
const CAMERA_X_IDLE = -0.18;
// Opening a region flies the camera right INSIDE the brain, and to the
// region's OWN part of it: the camera ends up on the region's side of
// the centre, at its height, looking out at its wall. Standing at the
// middle of the brain looking across at a distant region read as
// hovering above it rather than being in it — this fraction is how far
// out along the region's own anchor the camera travels.
//
// Kept well short of the wall: at 0.62 the viewer was right up against
// the network with no room to see it, so this is roughly a quarter of
// the way out — still on the region's side, still inside the brain, but
// with the area laid out in front of you rather than in your face.
const FOCUS_DEPTH = 0.26;
// The top and bottom regions can't be entered the way the other four
// are. "Stand on the far side and look across" puts the camera directly
// UNDER the parietal lobe and directly OVER the stem, staring straight
// up or straight down: no horizon, the region hanging overhead like a
// ceiling, nothing like the level view the side regions give. So those
// two get a station of their own — nearly at the region's own height,
// stepped off to one side, looking almost level across at it.
//
// Those two are described the other way round: how far back the camera
// stands from the region (as a multiple of how far out the anchor
// itself is) and how steeply it looks up or down at it from there. The
// shallow angle is the whole point — the same near-level view across a
// region that standing opposite gives everywhere else — and the
// distance is kept short enough to stay well inside the shell.
const VERTICAL_VIEW_DISTANCE = 1.15;
const VERTICAL_VIEW_ELEVATION = 0.5;
// Below this horizontal distance from the brain's axis, an anchor counts
// as one of those (matches VERTICAL_ANCHOR_LIMIT in state/brainRegions).
const VERTICAL_ANCHOR = 0.25;
// Just below the frame's centre — a nudge, not the deep offset earlier
// rounds ended up with. Applied as a camera height rather than a brain
// position, so the brain's own local space (which every region anchor is
// expressed in) stays untouched.
const CAMERA_Y_BASE = 0.12;
const CAMERA_EASE = 2.4;
// Field of view, eased alongside the move. Inside a region a wider lens
// is what actually buys room: the camera can only back off so far before
// it leaves the area entirely, whereas opening the angle pushes the
// whole network away from the viewer and shows more of it at once.
const CAMERA_FOV = 50;
const CAMERA_FOV_FOCUSED = 72;
// Dragging: radians per pixel, and how far up/down it can go. The pitch
// stops short of straight up so there's always a sense of which way is
// up; the horizontal angle is unbounded, so you can keep going round and
// round. Outside a region the drag ORBITS the camera around the brain;
// inside one it turns the camera on the spot.
const LOOK_SPEED = 0.004;
const MAX_LOOK_PITCH = 1.2;
// The camera drifts slowly around the brain when left alone. The brain
// itself no longer turns at all — this is what replaced it, so what you
// see is one object being walked around rather than a thing on a
// turntable.
const IDLE_ORBIT_SPEED = 0.05;
// How fast the view swings to a topic when one is opened. Slow enough
// to be followed as a turn rather than a cut.
const LOOK_AIM_SPEED = 2.2;

// Opening the Laboratory doesn't cut to it: the camera leaves the brain
// and flies out to the Moon, and the Laboratory — which is standing on
// the Moon (see its moonscape background) — fades up as the surface
// fills the frame. Two views of one place, rather than two screens.
//
// The flight, in seconds, and how far short of the Moon it stops, as a
// multiple of the Moon's own radius: close enough that the surface is
// all there is to see, far enough not to clip through it.
const DEPARTURE_SECONDS = 2.2;
const DEPARTURE_STANDOFF = 1.9;
// When the scene actually changes over. A little after the flight ends,
// so the glare has covered the screen before anything switches.
const DEPARTURE_MS = 2700;

// A soft edge vignette over whatever the sky is showing — transparent in
// the middle, darker at the very edges. NOT a centered bright-to-dark
// radial, which read as a glowing "bubble" behind the brain in an
// earlier version.
//
// The starfield itself is no longer here: it's a sphere INSIDE the scene
// now (see SpaceBackdrop), so it turns with the camera instead of
// staying pinned to the window. What's left behind the canvas is this
// vignette and a flat dark base for the moments before the sky texture
// has loaded.
const BACKDROP_VIGNETTE = "radial-gradient(ellipse 140% 120% at 50% 50%, transparent 45%, rgba(0,0,0,0.55) 100%)";

function anchorFromEvent(event: MouseEvent<HTMLElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Eases the camera between "whole brain" and "one region open" framing.
 * A component rather than a prop on <Canvas> because only something
 * inside the Canvas can use useFrame — and this has to animate, not jump.
 */
/**
 * Where the camera stands while a region is open, in the orbit's own
 * spherical terms, plus the point it faces from there (see focusStation
 * and focusAim).
 */
interface Station {
    yaw: number;
    pitch: number;
    radius: number;
    aim: [number, number, number];
}

interface LookState {
    /**
     * Outside a region these are the ORBIT angles around the brain;
     * inside one they're how far the camera has been turned from the
     * direction it arrived facing. Same two numbers, same drag, and the
     * mode decides what they mean.
     */
    yaw: number;
    pitch: number;
    /**
     * The camera's LIVE position around the brain, in the same spherical
     * terms. Written by the rig every frame and read back when a region
     * closes, so pulling out resumes from wherever the camera actually
     * is rather than snapping back to the front.
     */
    orbitYaw: number;
    orbitPitch: number;
    orbitRadius: number;
    /** True while a drag is in progress, which pauses the idle orbit. */
    dragging: boolean;
    /**
     * Where the view is being turned to, if anywhere — set when a topic
     * is opened (from the panel, the dial, or a pin on the brain), and
     * cleared the moment the viewer takes over by dragging.
     */
    target: { yaw: number; pitch: number } | null;
    /**
     * The flight out to the Moon, once the Laboratory has been asked
     * for. `departFrom` is wherever the camera happened to be when it
     * started — captured on the first frame of the flight, so the move
     * begins from the real view rather than from a canonical one.
     */
    departFrom: Vector3 | null;
    departProgress: number;
    /** The same flight run backwards, on the way back in from the Moon. */
    arriveProgress: number;
}

/**
 * Where the camera stands when a region is open, in the same spherical
 * terms the orbit uses: an angle around the brain and a radius.
 *
 * It sits on the side OPPOSITE the region, inside the brain, so the
 * region's own wall is the thing straight ahead. That's what makes the
 * approach read as flying into the brain: the camera swings round to
 * that side and dives inward, facing the same way the whole time.
 * Stationing it on the region's own side instead (an earlier version)
 * meant flying THROUGH the region and then turning back to look at it,
 * which is exactly the "coming in from somewhere else" it looked like.
 */
function isVerticalAnchor(anchor: readonly [number, number, number]): boolean {
    return Math.hypot(anchor[0], anchor[2]) < VERTICAL_ANCHOR;
}

/** The point a focused camera faces — see focusStation. */
function focusAim(anchor: readonly [number, number, number]): [number, number, number] {
    // The side regions are looked at THROUGH the centre (the camera is
    // opposite them, so the two directions are the same) and that stays
    // untouched. Only the top and bottom, where the camera now stands
    // beside the region instead of opposite it, need to be told what
    // they're looking at.
    if (!isVerticalAnchor(anchor)) return [CAMERA_X_IDLE, CAMERA_Y_BASE * 0.4, 0];
    return [anchor[0] * BRAIN_SCALE + CAMERA_X_IDLE, anchor[1] * BRAIN_SCALE, anchor[2] * BRAIN_SCALE];
}

function focusStation(anchor: readonly [number, number, number]): Station {
    const aim = focusAim(anchor);

    if (isVerticalAnchor(anchor)) {
        // Placed as a POINT — back from the region along a shallow line
        // of sight — and only then expressed in the orbit's spherical
        // terms, because "the side opposite the region" degenerates on
        // the vertical axis: every side is opposite, and the one the
        // arithmetic below picks is straight down (or straight up).
        const target = new Vector3(aim[0], aim[1], aim[2]);
        const distance = target.length() * VERTICAL_VIEW_DISTANCE;
        // Up at the parietal lobe, down at the stem — whichever way the
        // region itself lies. The step back is toward the front (+Z),
        // where the whole-brain view already stands, so the fly-in
        // doesn't swing round the brain first.
        const rising = Math.sign(anchor[1]) || 1;
        const position = target.clone().sub(new Vector3(
            0,
            Math.sin(VERTICAL_VIEW_ELEVATION) * distance * rising,
            -Math.cos(VERTICAL_VIEW_ELEVATION) * distance,
        ));

        // Back into the orbit's own terms — the rig builds its position
        // out of these three plus the standing x/y offsets, so those
        // come off here.
        position.sub(new Vector3(CAMERA_X_IDLE, CAMERA_Y_BASE, 0));
        const radius = position.length();
        return {
            yaw: Math.atan2(position.x, position.z),
            pitch: Math.asin(Math.max(-1, Math.min(1, position.y / radius))),
            radius,
            aim,
        };
    }

    const direction = new Vector3(anchor[0], anchor[1], anchor[2]).normalize();
    const radius = new Vector3(anchor[0], anchor[1], anchor[2]).length() * BRAIN_SCALE * FOCUS_DEPTH;

    // The orbit angle of the point OPPOSITE the region: the camera
    // stands there and looks back across the centre at it.
    return {
        yaw: Math.atan2(-direction.x, -direction.z),
        pitch: Math.asin(Math.max(-1, Math.min(1, -direction.y))),
        radius,
        aim,
    };
}

/** Camera yaw/pitch that look along a given direction. */
function anglesToward(direction: Vector3): { yaw: number; pitch: number } {
    return {
        // A camera at yaw φ looks along (-sin φ, 0, -cos φ): three
        // rotates around +Y and the un-rotated camera faces -Z.
        yaw: Math.atan2(-direction.x, -direction.z),
        pitch: Math.asin(Math.max(-1, Math.min(1, direction.y))),
    };
}

const orbitPosition = new Vector3();
const inwardDirection = new Vector3();
const aimPoint = new Vector3();
const stationAim = new Vector3();

const arrivalAim = new Vector3();
const moonCenter = new Vector3(MOON_POSITION[0], MOON_POSITION[1], MOON_POSITION[2]);
// Where the flight ends: short of the Moon along the line from the
// brain out to it, so the approach is a straight run rather than a
// swing around anything.
const moonApproach = moonCenter.clone()
    .multiplyScalar(1 - (MOON_RADIUS * DEPARTURE_STANDOFF) / moonCenter.length());

/** Slow at both ends, quick through the middle — a launch, not a pan. */
function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

/** Eases an angle toward a target the short way round. */
function easeAngle(current: number, target: number, step: number): number {
    let diff = (target - current) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * step;
}

/**
 * The camera. It always ORBITS the brain — an angle and a radius — and
 * always looks inward at it. Both modes are the same motion with
 * different targets:
 *
 *   - Whole brain: the angle is yours to drag (and drifts slowly on its
 *     own when left alone), at a radius that keeps the whole brain in
 *     frame, centred.
 *   - Region open: the angle swings round to the side opposite that
 *     region and the radius shrinks to inside the brain, so the camera
 *     flies IN along the line it's already looking down and ends up with
 *     that region's wall ahead of it. Dragging then turns the camera on
 *     the spot instead of moving it.
 *
 * Keeping one spherical state for both is what makes the transition
 * read as flying into the brain from wherever you happen to be standing.
 * Easing between two independent positions instead (an earlier version)
 * cut a straight line through space that had nothing to do with either
 * view, which is what made the entry look like it came from somewhere
 * else entirely.
 */
function CameraRig({ station, lookRef, departing, arriving }: {
    station: Station | null;
    lookRef: RefObject<LookState>;
    /** True once the Laboratory has been asked for — see DEPARTURE_SECONDS. */
    departing: boolean;
    /** True when this scene was opened by coming BACK from there. */
    arriving: boolean;
}) {
    useFrame((state, delta) => {
        const focused = station !== null;
        const look = lookRef.current;
        const step = Math.min(1, delta * CAMERA_EASE);

        const camera = state.camera as PerspectiveCamera;

        // The flight out to the Moon ignores the orbit entirely: it's a
        // straight line between two points in space, not an angle and a
        // radius around the brain, and it's the last thing this camera
        // does before the scene hands over.
        if (departing) {
            if (!look.departFrom) look.departFrom = camera.position.clone();
            look.departProgress = Math.min(1, look.departProgress + delta / DEPARTURE_SECONDS);

            camera.position.lerpVectors(look.departFrom, moonApproach, easeInOut(look.departProgress));
            if (Math.abs(camera.fov - CAMERA_FOV) > 0.01) {
                camera.fov += (CAMERA_FOV - camera.fov) * step;
                camera.updateProjectionMatrix();
            }
            camera.lookAt(moonCenter);
            return;
        }
        const targetFov = focused ? CAMERA_FOV_FOCUSED : CAMERA_FOV;
        if (Math.abs(camera.fov - targetFov) > 0.01) {
            camera.fov += (targetFov - camera.fov) * step;
            camera.updateProjectionMatrix();
        }

        // Left alone outside a region, the orbit keeps creeping round.
        if (!focused && !look.dragging) look.yaw += delta * IDLE_ORBIT_SPEED;

        const targetYaw = focused ? station.yaw : look.yaw;
        const targetPitch = focused ? station.pitch : look.pitch;
        const targetRadius = focused ? station.radius : CAMERA_Z;

        look.orbitYaw = easeAngle(look.orbitYaw, targetYaw, step);
        look.orbitPitch += (targetPitch - look.orbitPitch) * step;
        look.orbitRadius += (targetRadius - look.orbitRadius) * step;

        orbitPosition.set(
            Math.sin(look.orbitYaw) * Math.cos(look.orbitPitch) * look.orbitRadius + CAMERA_X_IDLE,
            Math.sin(look.orbitPitch) * look.orbitRadius + CAMERA_Y_BASE,
            Math.cos(look.orbitYaw) * Math.cos(look.orbitPitch) * look.orbitRadius,
        );
        // Coming back from the Laboratory, the camera starts where the
        // flight out left it — beside the Moon — and closes on the brain
        // over the same couple of seconds. Everything else about the
        // orbit is already computed above; this only decides where along
        // the way in the camera actually is.
        const returning = arriving && look.arriveProgress < 1;
        if (returning) {
            look.arriveProgress = Math.min(1, look.arriveProgress + delta / DEPARTURE_SECONDS);
            camera.position.lerpVectors(moonApproach, orbitPosition, easeInOut(look.arriveProgress));
        } else {
            camera.position.copy(orbitPosition);
        }

        // Always facing the brain — which, from inside on the far side of
        // a region, means facing that region's wall. For the top and
        // bottom regions the camera stands BESIDE the region instead of
        // opposite it, so what it faces is that region rather than the
        // centre (see focusAim) — and the aim slides from one to the
        // other over the fly-in, so the approach still watches the whole
        // brain until it's actually arrived.
        aimPoint.set(CAMERA_X_IDLE, CAMERA_Y_BASE * 0.4, 0);
        if (focused) {
            const travel = CAMERA_Z - station.radius;
            const arrived = travel > 0.001
                ? Math.min(1, Math.max(0, (CAMERA_Z - look.orbitRadius) / travel))
                : 1;
            aimPoint.lerp(stationAim.set(station.aim[0], station.aim[1], station.aim[2]), arrived);
        }
        inwardDirection.copy(aimPoint).sub(orbitPosition).normalize();
        const base = anglesToward(inwardDirection);

        if (focused && look.target) {
            const aim = Math.min(1, delta * LOOK_AIM_SPEED);
            look.yaw = easeAngle(look.yaw, look.target.yaw, aim);
            look.pitch += (look.target.pitch - look.pitch) * aim;
            if (Math.abs(look.target.yaw - look.yaw) < 0.002 && Math.abs(look.target.pitch - look.pitch) < 0.002) {
                look.target = null;
            }
        }

        // On the way back in, the view swings off the Moon and onto the
        // brain as the camera travels — driven by lookAt rather than by
        // the two angles, since it's a point in space being tracked, not
        // an orbit being held. The two agree by the time it lands.
        if (returning) {
            arrivalAim.lerpVectors(moonCenter, aimPoint, easeInOut(look.arriveProgress));
            camera.lookAt(arrivalAim);
            return;
        }

        // The up/down limit applies to where the camera actually ENDS UP,
        // which is the station's own pitch plus however far you've
        // dragged from it. Clamping only the drag (as this used to)
        // meant look.pitch kept climbing past a limit the view was
        // already held at: the picture stopped moving while the number
        // ran on, and dragging back did nothing at all until it had
        // unwound — exactly the "stuck, won't turn any further" it felt
        // like. Writing the clamped value back is what keeps the two in
        // step, so the very next pixel of drag the other way moves.
        const pitch = focused
            ? Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, base.pitch + look.pitch))
            : base.pitch;
        if (focused) look.pitch = pitch - base.pitch;

        camera.rotation.order = "YXZ";
        camera.rotation.set(pitch, focused ? base.yaw + look.yaw : base.yaw, 0);
    });
    return null;
}

/**
 * The KIWI HQ dashboard — mounted directly as the app's root (see
 * App.tsx). Canvas, camera, lights, and the Brain itself (BrainSystem3D
 * = NeuronLayer + ConnectionLayer + EnergyLayer) plus GlowLayer
 * (SelectiveBloom) and the brain's own clickable regions.
 *
 * The layout is now brain-first: a single full-viewport Canvas with
 * everything else floating over it. The orbiting icon ring (OrbitRing3D)
 * and both side widget columns were removed per explicit request —
 * between them they boxed the brain into a middle column barely a third
 * of the screen wide. Navigation moved onto the brain instead:
 *
 *   - BrainNavPanel (left rail) lists the regions; hovering one previews
 *     it, clicking one opens it.
 *   - BrainMiniMap (bottom-left) is the dial: it names the level you're
 *     on and rings it with whatever is one step away — the six regions
 *     from outside, that region's own modules once you're in one.
 *   - Clicking or hovering the brain itself resolves to whichever region
 *     you're pointing at (see BrainSystem3D's onPickDirection /
 *     onHoverDirection + regionAtLocalDirection); clicking between
 *     regions closes back to the whole brain. The regions carry no
 *     markers of their own — their color is what identifies them (see
 *     NeuronLayer) and BrainRegionLabels just names them.
 *   - Opening a region flies the camera INSIDE the brain to that
 *     region's own spot, brightens its neurons, and slides
 *     BrainRegionPanel in on the right. Its own live facts are then
 *     pinned onto its neurons (RegionDataPins), each one a button into
 *     the module it came from.
 *
 * No OrbitControls, but the camera does orbit: outside a region,
 * dragging swings it around the brain in any direction and it drifts
 * slowly round on its own when left alone, with the brain always centred
 * (see CameraRig). Inside a region it flies to that region's spot within
 * the brain and turns on the spot instead. The brain itself never
 * rotates — an earlier version spun the brain and pinned the camera
 * down, which reads as a model on a turntable rather than a place.
 *
 * The sky is a real photo on a sphere around the whole scene (see
 * SpaceBackdrop), so it turns with the camera the way everything else
 * does. It used to be a CSS background-image behind the transparent
 * Canvas, which stopped working the moment the camera started moving:
 * a sky pinned to the window while the scene rotates in front of it is
 * the strongest possible tell that a 3D view isn't real. The CSS layer
 * behind the canvas is now just an edge vignette over it.
 *
 * The brain's internal pulse Line objects (via EnergyLayer's onReady,
 * threaded through BrainSystem3D) are lifted up here purely so
 * GlowLayer's SelectiveBloom can target exactly those objects — see
 * GlowLayer's doc comment for why a plain global-threshold Bloom
 * couldn't do this.
 *
 * The top bar carries no sign-in/account area any more (also removed per
 * explicit request — it isn't needed at this stage), and neither does
 * Laboratory's.
 */
interface BrainScene3DProps {
    // Fired by TopBar's Laboratory icon (and by the Laboratory module
    // inside the Parietal region) — App.tsx swaps this whole scene out
    // for components/laboratory/Laboratory when set.
    onOpenLaboratory?: () => void;
    /** True when the dashboard was reached by coming back from there. */
    arriving?: boolean;
    // Read-only here — the region panel's Calendar/Projects/Notes
    // modules show the very same events, projects and notes Laboratory
    // edits (both owned by App.tsx), so adding one there shows up on the
    // brain without any syncing in between.
    calendar: CalendarState;
    laboratoryData: LaboratoryDataState;
    // Owned by App.tsx (state/spotify.ts) — shared with Laboratory so
    // the connection survives switching scenes (see that file's own
    // doc comment for why it can't just be local state here).
    spotify: SpotifyState;
}

export default function BrainScene3D({ onOpenLaboratory, arriving = false, calendar, laboratoryData, spotify }: BrainScene3DProps) {
    const ambientLight = useMemo(() => new AmbientLight(0xffffff, 0.5), []);
    const [pulseLines, setPulseLines] = useState<Line[]>([]);
    // Lifted from VoiceBar (see its own onListeningChange doc) so the
    // brain glows brighter while Hey Kiwi is actively listening —
    // GlowLayer is a sibling here, not a descendant, so this has to live
    // up here. (It used to pause the brain's rotation too; the brain
    // doesn't rotate any more, the camera orbits it.)
    const [kiwiListening, setKiwiListening] = useState(false);
    const [detail, setDetail] = useState<DetailDrawerContent | null>(null);
    // The opened region (nav rail, marker, or a click on the brain) and
    // the merely-previewed one (hovering the rail or a marker). Both are
    // read by the brain itself, which is why they live here rather than
    // inside the nav panel.
    const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
    const [hoverRegionId, setHoverRegionId] = useState<string | null>(null);
    // Which of the open region's modules is showing its full contents.
    // Up here rather than inside the panel because the pins on the brain
    // open modules as well (see RegionDataPins).
    const [openModuleId, setOpenModuleId] = useState<string | null>(null);
    // True from the moment the Laboratory is asked for until the scene
    // hands over — the camera is on its way to the Moon and everything
    // over the top of it is fading out.
    const [departing, setDeparting] = useState(false);
    // Which single story is open inside that module — see
    // regionContent/types.ts for why it lives up here and not in the
    // module that renders it.
    const [openStoryId, setOpenStoryId] = useState<string | null>(null);
    const openStoryRef = useRef<(storyId: string | null) => void>(() => {});
    // Where the camera is looking while inside a region. A ref, not
    // state: it changes with every mouse move during a drag, and the
    // only consumer is the camera rig's own frame loop.
    const lookRef = useRef<LookState>({
        yaw: 0, pitch: 0,
        orbitYaw: 0, orbitPitch: 0, orbitRadius: CAMERA_Z,
        dragging: false, target: null,
        departFrom: null, departProgress: 0, arriveProgress: 0,
    });
    const activeRegion = findBrainRegion(activeRegionId);
    // Short facts about the open region, for the pins sitting on its
    // neurons (see RegionDataPins). Reads the same cached fetches its
    // panel does, so flying in costs no extra requests.
    const openStory = useCallback((storyId: string | null) => openStoryRef.current(storyId), []);
    const regionContext = useMemo(
        () => ({ calendar, laboratoryData, openStoryId, openStory }),
        [calendar, laboratoryData, openStoryId, openStory],
    );
    const regionFacts = useRegionFacts(activeRegion, regionContext);

    // Entering or leaving a region starts the camera's angles over: they
    // mean different things in the two modes (orbit vs. look-around), so
    // carrying a value across would land the camera somewhere arbitrary.
    const resetLook = () => {
        lookRef.current.yaw = 0;
        lookRef.current.pitch = 0;
        lookRef.current.target = null;
    };

    // Coming back out, the orbit picks up from where the camera actually
    // is rather than from the angle it was left at before flying in.
    const resumeOrbit = () => {
        lookRef.current.yaw = lookRef.current.orbitYaw;
        lookRef.current.pitch = lookRef.current.orbitPitch;
        lookRef.current.target = null;
    };

    const selectRegion = (id: string) => {
        if (id !== activeRegionId) resetLook();
        setActiveRegionId(id);
        setOpenModuleId(null);
        setOpenStoryId(null);
        setDetail(null);
    };

    const closeRegion = () => {
        resumeOrbit();
        setActiveRegionId(null);
        setOpenModuleId(null);
        setOpenStoryId(null);
        setDetail(null);
    };

    // A click straight on the brain body: whichever region it pointed at
    // opens; a click in the gaps between regions closes back out to the
    // whole brain, which doubles as the way to undo an accidental one.
    const handleBrainPick = (direction: [number, number, number]) => {
        const region = regionAtLocalDirection(direction);
        if (region) selectRegion(region.id);
        else closeRegion();
    };

    // Hovering the brain brightens whichever area the cursor is over —
    // the same preview the nav rail's rows give. Fires on every pointer
    // move across the brain, so it only touches state when the region
    // under the cursor actually changes.
    const handleBrainHover = (direction: [number, number, number] | null) => {
        const region = direction ? regionAtLocalDirection(direction) : null;
        setHoverRegionId((current) => (current === (region?.id ?? null) ? current : region?.id ?? null));
    };

    // Dragging inside a region turns the camera on the spot — a proper
    // look-around, since the camera is within the brain there (see
    // BrainSystem3D's onLook).
    // Turns the view toward one spot inside the open region — a
    // module's own place in the brain, or the pin of a single story
    // within it. Called whenever anything is opened from anywhere: the
    // panel, the dial, or a pin out on the wall. Nothing you open is
    // ever something you then have to go and find.
    const aimAtSite = (site: [number, number, number] | null | undefined) => {
        const look = lookRef.current;
        if (!site || !activeRegion) {
            look.target = null;
            return;
        }

        // The brain never rotates now, so a site's own coordinates are
        // already its place in the world. What's needed is the angle
        // from where the camera stands to there, expressed as an offset
        // from the direction the camera faces by default there (looking
        // back at the brain) — which is what look.yaw and look.pitch
        // mean inside a region.
        const station = focusStation(activeRegion.anchor);
        const cameraPosition = new Vector3(
            Math.sin(station.yaw) * Math.cos(station.pitch) * station.radius + CAMERA_X_IDLE,
            Math.sin(station.pitch) * station.radius + CAMERA_Y_BASE,
            Math.cos(station.yaw) * Math.cos(station.pitch) * station.radius,
        );

        const toSite = new Vector3(site[0] * BRAIN_SCALE, site[1] * BRAIN_SCALE, site[2] * BRAIN_SCALE)
            .sub(cameraPosition)
            .normalize();
        const inward = new Vector3(station.aim[0], station.aim[1], station.aim[2]).sub(cameraPosition).normalize();

        const desired = anglesToward(toSite);
        const base = anglesToward(inward);
        look.target = {
            yaw: desired.yaw - base.yaw,
            pitch: Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, desired.pitch - base.pitch)),
        };
    };

    const aimAtModule = (moduleId: string | null) =>
        aimAtSite(moduleId && activeRegion ? regionSites(activeRegion).get(moduleId) : null);

    // A story's spot is its PIN's spot — the same arithmetic the pins
    // themselves are placed by (see regionPins), so opening a headline
    // in the panel turns the view to the very label that headline is
    // written on out in the brain.
    const aimAtStory = (storyId: string | null) => {
        if (!storyId) return;
        const pin = regionPins(activeRegion, regionFacts).find((entry) => entry.fact.storyId === storyId);
        // A story with no pin (further down the list than the wall has
        // room for) leaves the view where it is rather than turning to
        // an arbitrary spot: the panel is already showing it.
        if (pin) aimAtSite(pin.position);
    };

    const openModule = (moduleId: string | null) => {
        setOpenModuleId(moduleId);
        setOpenStoryId(null);
        aimAtModule(moduleId);
    };

    // Opening one story: the panel shows it and the camera turns to it.
    const openStoryImpl = (storyId: string | null) => {
        setOpenStoryId(storyId);
        if (storyId) aimAtStory(storyId);
    };
    // Handed to every module through the region context, which is
    // memoised — so the identity handed down has to hold still even
    // though what it DOES depends on the region and the facts of this
    // render. The ref is the join between the two: a stable callback
    // out, the current implementation in, refreshed after every render
    // rather than during one.
    useEffect(() => { openStoryRef.current = openStoryImpl; });

    // A pin on the wall opens what it stands for: its module, and the
    // one story it names if it names one.
    const openFact = (fact: RegionFact) => {
        setOpenModuleId(fact.moduleId);
        setOpenStoryId(fact.storyId ?? null);
        aimAtSite(regionPins(activeRegion, regionFacts).find((entry) => entry.fact === fact)?.position);
    };

    // Dragging is caught on the scene's own root element rather than on
    // the brain, so the whole window turns the view. Chasing the brain
    // with the pointer just to look around was the worst part of the
    // old behaviour — and once a region is open, the brain fills the
    // screen anyway, so "drag the brain" and "drag anywhere" were
    // already the same gesture there.
    const dragRef = useRef({ active: false, dragged: false, x: 0, y: 0 });

    // Anything with its own controls keeps them: a drag that starts on a
    // panel, the rail, the dial or the top bar is that control's, not a
    // camera move.
    const UI_SELECTOR = ".brain-nav, .region-panel, .brain-dial, .top-bar, .brain-voice-bar-row, .detail-drawer, .region-label, .region-pin";

    const handleScenePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest(UI_SELECTOR)) return;
        dragRef.current = { active: true, dragged: false, x: event.clientX, y: event.clientY };
        lookRef.current.dragging = true;
    };

    const handleScenePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag.active) return;

        const deltaX = event.clientX - drag.x;
        const deltaY = event.clientY - drag.y;
        drag.x = event.clientX;
        drag.y = event.clientY;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 2) drag.dragged = true;

        handleLook(deltaX, deltaY);
    };

    const handleScenePointerUp = () => {
        dragRef.current.active = false;
        lookRef.current.dragging = false;
        // Cleared on the next tick, so the click that follows this
        // release can still see that it was the end of a drag.
        window.setTimeout(() => { dragRef.current.dragged = false; }, 0);
    };

    const handleLook = (deltaX: number, deltaY: number) => {
        // Dragging moves the SCENE with the pointer, the way a photo
        // moves under your finger on a phone: drag right and the brain
        // swings right. The two modes need OPPOSITE signs to arrive at
        // that same feel, which is why this reads as a special case and
        // isn't one — inside a region the yaw turns the camera on the
        // spot (turning it right sweeps the scene left), while outside it
        // walks the camera around the brain (walking right brings the
        // brain's right side toward you, sweeping the scene left as
        // well). Same intent, opposite arithmetic.
        const look = lookRef.current;
        // Taking the wheel cancels any turn toward a topic.
        look.target = null;
        look.dragging = true;
        look.yaw += (activeRegionId ? 1 : -1) * deltaX * LOOK_SPEED;
        look.pitch = Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, look.pitch + deltaY * LOOK_SPEED));
    };

    // Modules that aren't content but a jump elsewhere — Laboratory is
    // the only one today. Everything else renders inside the panel
    // itself (see BrainRegionPanel's two levels).
    //
    // It doesn't jump straight there: the camera flies out to the Moon
    // first and the scene changes over once the surface fills the frame
    // (see DEPARTURE_SECONDS). Both ways in — this and the top bar's
    // own button — go through here, so the trip happens either way.
    const leaveForLaboratory = () => setDeparting(true);

    useEffect(() => {
        if (!departing) return;
        const timer = window.setTimeout(() => onOpenLaboratory?.(), DEPARTURE_MS);
        return () => window.clearTimeout(timer);
    }, [departing, onOpenLaboratory]);

    // Escape backs out one level: an open detail card first, then the
    // open region. Restored per explicit request after an earlier
    // rewrite of this scene dropped it — every other way out (the
    // panel's X, "Whole brain", clicking between regions) needs the
    // pointer, and flying inside the brain is exactly the moment a
    // keyboard way out matters.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            if (detail) setDetail(null);
            else if (openStoryId) setOpenStoryId(null);
            else if (openModuleId) setOpenModuleId(null);
            else if (activeRegionId) closeRegion();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [detail, activeRegionId, openModuleId, openStoryId]);

    const handleInfoClick = (event: MouseEvent<HTMLElement>) => {
        setDetail({
            title: "Info",
            anchor: anchorFromEvent(event),
            width: 440,
            maxHeight: 700,
            body: <InfoPanel />,
        });
    };

    return (
        <div
            className={`brain-scene${departing ? " brain-scene-departing" : ""}`}
            style={{ backgroundImage: BACKDROP_VIGNETTE }}
            onPointerDown={handleScenePointerDown}
            onPointerMove={handleScenePointerMove}
            onPointerUp={handleScenePointerUp}
            onPointerLeave={handleScenePointerUp}
        >
            <div className="brain-scene-canvas">
                <Canvas camera={{
                        position: [CAMERA_X_IDLE, CAMERA_Y_BASE, CAMERA_Z],
                        fov: CAMERA_FOV,
                        // The environment reaches thousands of units out
                        // (Andromeda alone sits at 2600 — see
                        // SpaceBackdrop), and three's default far plane
                        // of 2000 simply clips everything past it: the
                        // galaxy was being drawn correctly and then
                        // thrown away by the projection.
                        far: 12000,
                    }} gl={{ alpha: true }}>
                    <primitive object={ambientLight} />
                    <SpaceBackdrop />
                    <CameraRig
                        station={activeRegion ? focusStation(activeRegion.anchor) : null}
                        lookRef={lookRef}
                        departing={departing}
                        arriving={arriving}
                    />
                    <group scale={BRAIN_SCALE}>
                        <BrainSystem3D
                            onPulseReady={setPulseLines}
                            focusRegionId={activeRegionId}
                            hoverRegionId={hoverRegionId}
                            onPickDirection={handleBrainPick}
                            onHoverDirection={handleBrainHover}
                            wasDragged={() => dragRef.current.dragged}
                        >
                            <BrainRegionLabels
                                activeRegionId={activeRegionId}
                                hoverRegionId={hoverRegionId}
                                onSelect={selectRegion}
                                onHover={setHoverRegionId}
                            />
                            {/* Always mounted, drawing nothing without an
                                open region — see its own doc comment. */}
                            <RegionDataPins
                                region={activeRegion}
                                facts={regionFacts}
                                onOpenFact={openFact}
                            />
                        </BrainSystem3D>
                    </group>
                    <GlowLayer selection={pulseLines} lights={[ambientLight]} boosted={kiwiListening} />
                </Canvas>
            </div>

            <TopBar onInfoClick={handleInfoClick} onLaboratoryClick={leaveForLaboratory} spotify={spotify} />

            <BrainNavPanel
                activeRegionId={activeRegionId}
                hoverRegionId={hoverRegionId}
                onSelect={selectRegion}
                onHover={setHoverRegionId}
            />

            <BrainMiniMap
                activeRegionId={activeRegionId}
                hoverRegionId={hoverRegionId}
                openModuleId={openModuleId}
                onSelectRegion={selectRegion}
                onHoverRegion={setHoverRegionId}
                onOpenModule={openModule}
                onReset={closeRegion}
            />

            {activeRegion && (
                <BrainRegionPanel
                    // Keyed by region: opening a different area starts on
                    // its own overview, rather than inheriting whichever
                    // module was open in the area you just left.
                    key={activeRegion.id}
                    region={activeRegion}
                    context={regionContext}
                    openModuleId={openModuleId}
                    onOpenModule={openModule}
                    onClose={closeRegion}
                    onModuleAction={leaveForLaboratory}
                />
            )}

            <div className="brain-voice-bar-row">
                <VoiceBar onListeningChange={setKiwiListening} />
            </div>

            <DetailDrawer content={detail} onClose={() => setDetail(null)} />

            {/* Sunlight off the regolith, washing the scene out as the
                camera closes on the Moon. It's what hides the seam: the
                Laboratory takes over behind a white screen rather than
                cutting in over a starfield. */}
            {departing && <div className="brain-departure-glare" aria-hidden="true" />}

            {/* The same glare on the way in, clearing as the camera
                pulls away from the surface. */}
            {arriving && <div className="brain-arrival-glare" aria-hidden="true" />}
        </div>
    );
}
