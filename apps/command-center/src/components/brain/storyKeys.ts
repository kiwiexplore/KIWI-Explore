/**
 * The id a single story is known by across the whole scene.
 *
 * Two very different things have to name the same story: the module
 * that renders it in the panel (see regionContent/LiveModules) and the
 * fact pinned to a neuron out in the brain (see regionContent/
 * regionFacts). When you open a headline the camera turns to its own
 * spot in the region, and when you click that spot the panel opens that
 * headline — neither works unless both sides call it the same thing.
 *
 * Prefixed by module and source rather than using the feed's own id
 * alone: those are only unique within one API, and two of them meeting
 * on the same number would send the camera to the wrong wall.
 */
export const financeStoryKey = (id: string) => `finance:${id}`;
export const liberecStoryKey = (id: string) => `news:liberec:${id}`;
export const worldStoryKey = (id: string) => `news:world:${id}`;
export const techStoryKey = (id: number) => `news:tech:${id}`;
export const launchStoryKey = (id: string) => `space:launch:${id}`;
export const articleStoryKey = (id: number) => `space:article:${id}`;
export const recipeStoryKey = (id: string) => `meals:${id}`;
