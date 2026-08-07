// Live recipe ideas via TheMealDB (https://www.themealdb.com/api.php) —
// free, public test API key ("1"), CORS-enabled for direct browser
// fetches. Fourth live-data widget alongside weather/space-news/space-
// missions — see RecipesWidget. random.php only returns one meal per
// call, so a handful of ideas means a handful of parallel calls.

export interface Recipe {
    id: string;
    name: string;
    category: string;
    area: string;
    thumbnail: string;
    instructions: string;
    sourceUrl: string;
}

interface MealDbMeal {
    idMeal: string;
    strMeal: string;
    strCategory: string;
    strArea: string;
    strMealThumb: string;
    strInstructions: string;
    strSource: string | null;
    strYoutube: string | null;
}

export async function fetchRandomRecipes(count = 5): Promise<Recipe[]> {
    const results = await Promise.all(
        Array.from({ length: count }, async () => {
            const res = await fetch("https://www.themealdb.com/api/json/v1/1/random.php");
            if (!res.ok) throw new Error(`TheMealDB request failed: ${res.status}`);
            const data = await res.json();
            return data.meals[0] as MealDbMeal;
        }),
    );

    const seen = new Set<string>();
    return results
        .filter((meal) => (seen.has(meal.idMeal) ? false : (seen.add(meal.idMeal), true)))
        .map((meal) => ({
            id: meal.idMeal,
            name: meal.strMeal,
            category: meal.strCategory,
            area: meal.strArea,
            thumbnail: meal.strMealThumb,
            instructions: meal.strInstructions,
            sourceUrl: meal.strSource || meal.strYoutube || `https://www.themealdb.com/meal/${meal.idMeal}`,
        }));
}
