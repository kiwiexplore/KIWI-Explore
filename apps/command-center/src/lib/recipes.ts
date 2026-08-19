// Live recipe ideas via TheMealDB (https://www.themealdb.com/api.php) —
// free, public test API key ("1"), CORS-enabled for direct browser
// fetches.
//
// Not "any meal": the ideas are drawn from the animal-protein
// categories only (per explicit request — the point of this module is
// training food, and every one of these is built around a cut of meat
// or fish rather than around pastry). Dessert, Side, Starter and the
// vegetarian/vegan categories are simply never asked for.
//
// TheMealDB carries no nutrition data at all — no calories, no protein
// in grams — so nothing here claims any. What it does carry is the
// ingredient list, which is why that's shown: it's the honest version
// of "is this a protein meal", and you can see the cut for yourself.

export interface RecipeIngredient {
    name: string;
    measure: string;
}

export interface Recipe {
    id: string;
    name: string;
    category: string;
    area: string;
    thumbnail: string;
    /** Opening of the method — enough to tell what cooking it involves. */
    excerpt: string;
    instructions: string;
    ingredients: RecipeIngredient[];
    sourceUrl: string;
}

/**
 * The categories TheMealDB files meat and fish dishes under. Chicken,
 * beef, seafood, lamb, pork and goat are the whole animal-protein half
 * of its catalogue; "Miscellaneous" and "Pasta" are left out because
 * they're a coin toss on whether there's any meat in them at all.
 */
const PROTEIN_CATEGORIES = ["Chicken", "Beef", "Seafood", "Lamb", "Pork", "Goat"];

// How many categories one refresh draws from. Two keeps a batch varied
// without turning a single glance at the module into six requests.
const CATEGORIES_PER_BATCH = 2;

interface MealDbMeal {
    idMeal: string;
    strMeal: string;
    strCategory: string;
    strArea: string;
    strMealThumb: string;
    strInstructions: string;
    strSource: string | null;
    strYoutube: string | null;
    [key: string]: string | null;
}

function shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// The method, cut to a sentence boundary — a step that stops mid-word
// reads as broken data rather than as a preview.
function firstSentences(text: string, maxLength = 190): string {
    const clean = (text ?? "").replace(/\s+/g, " ").trim();
    if (clean.length <= maxLength) return clean;

    const cut = clean.slice(0, maxLength);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    if (lastStop > maxLength * 0.5) return cut.slice(0, lastStop + 1);
    return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

// TheMealDB stores ingredients as twenty numbered pairs of columns
// rather than as a list, most of them empty.
function readIngredients(meal: MealDbMeal): RecipeIngredient[] {
    const list: RecipeIngredient[] = [];
    for (let i = 1; i <= 20; i++) {
        const name = (meal[`strIngredient${i}`] ?? "").trim();
        if (!name) continue;
        list.push({ name, measure: (meal[`strMeasure${i}`] ?? "").trim() });
    }
    return list;
}

export function toRecipe(meal: MealDbMeal): Recipe {
    return {
        id: meal.idMeal,
        name: meal.strMeal,
        category: meal.strCategory,
        area: meal.strArea,
        // TheMealDB serves a small version of any picture from the same
        // URL with /preview on the end — 7 kB against 95 kB, for a
        // thumbnail shown at 58 pixels.
        thumbnail: meal.strMealThumb ? `${meal.strMealThumb}/preview` : "",
        excerpt: firstSentences(meal.strInstructions),
        instructions: meal.strInstructions,
        ingredients: readIngredients(meal),
        sourceUrl: meal.strSource || meal.strYoutube || `https://www.themealdb.com/meal/${meal.idMeal}`,
    };
}

/** One recipe in full, by id — what a saved recipe reopens with. */
export async function fetchRecipe(id: string): Promise<Recipe | null> {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`TheMealDB request failed: ${res.status}`);
    const data = await res.json();
    const meal = data.meals?.[0] as MealDbMeal | undefined;
    return meal ? toRecipe(meal) : null;
}

/**
 * A handful of animal-protein recipes, in full.
 *
 * Two calls to get the field (category listings carry nothing but an
 * id, a name and a picture), then one lookup per recipe kept — the only
 * endpoint that returns ingredients and a method.
 */
export async function fetchProteinRecipes(count = 5): Promise<Recipe[]> {
    const categories = shuffle(PROTEIN_CATEGORIES).slice(0, CATEGORIES_PER_BATCH);

    const listings = await Promise.all(categories.map(async (category) => {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${category}`);
        if (!res.ok) throw new Error(`TheMealDB request failed: ${res.status}`);
        const data = await res.json();
        return (data.meals ?? []) as { idMeal: string }[];
    }));

    const ids = shuffle(listings.flat().map((meal) => meal.idMeal)).slice(0, count);
    const recipes = await Promise.all(ids.map((id) => fetchRecipe(id)));
    return recipes.filter((recipe): recipe is Recipe => recipe !== null);
}
