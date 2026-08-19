/**
 * Where the Moon hangs in the dashboard's sky.
 *
 * Its own file rather than a constant inside SpaceBackdrop because two
 * places need to agree on it: the backdrop draws the Moon there, and
 * the camera flies to it when the Laboratory is opened (see
 * BrainScene3D's departure). A file that exports both a component and a
 * constant also breaks Vite's fast refresh — the same reason
 * moduleCatalog.ts sits beside ModuleContent.
 *
 * The nearest major body, off to one side of the brain, and the one
 * object whose position visibly shifts against the background as the
 * camera moves during a fly-in — that parallax is what proves
 * everything beyond it is genuinely further away rather than painted
 * on.
 *
 * Not a real distance, like everything else in that sky: the scene is
 * standing in Earth-Moon space and the near bodies are placed by eye
 * (see SpaceBackdrop) rather than to scale, which nothing at this range
 * could be.
 */
export const MOON_POSITION: [number, number, number] = [4.2, -2.2, -3.4];
export const MOON_RADIUS = 1.15;
