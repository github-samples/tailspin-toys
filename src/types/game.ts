/**
 * Centralized type definitions for game-related data structures.
 * These interfaces describe the shape returned by the Drizzle data-access
 * helpers in `src/lib/games.ts` and consumed by Astro pages/components.
 */

/** Represents a game publisher (summary form used in listings). */
export interface Publisher {
    id: number;
    name: string;
}

/** Represents a game category (summary form used in listings). */
export interface Category {
    id: number;
    name: string;
}

/** Represents a game with its related category and publisher. */
export interface Game {
    id: number;
    title: string;
    description: string;
    publisher: Publisher | null;
    category: Category | null;
    starRating: number | null;
}
