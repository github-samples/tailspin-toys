/**
 * Builds the grounding file consumed by the Backer Concierge agent.
 *
 * `toCatalogExport` is a pure transform so it can be unit tested without a
 * database, and the CLI below reads the seeded database through the injectable
 * `src/lib/games.ts` helpers. The output is deterministic (sorted, no
 * `Math.random`) so re-running the export produces byte-identical JSON.
 *
 * Run with: `npm run db:export`
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createDatabase, type Database } from '../src/lib/db';
import { getAllGames } from '../src/lib/games';
import { formatStarRating } from '../src/lib/ratings';
import type { Game } from '../src/types/game';

const here = dirname(fileURLToPath(import.meta.url));

/** Default location of the generated grounding file. */
export const CATALOG_EXPORT_PATH = join(here, 'catalog.json');

const UNKNOWN_CATEGORY = 'Uncategorized';
const UNKNOWN_PUBLISHER = 'Unknown publisher';

/** A single catalog entry as the agent sees it. */
export interface CatalogGame {
    id: number;
    title: string;
    description: string;
    category: string;
    publisher: string;
    /** Omitted entirely when the game has no rating, so the export contains no nulls. */
    starRating?: number;
    ratingLabel: string;
}

/** The full grounding document uploaded to the agent. */
export interface CatalogExport {
    source: string;
    note: string;
    gameCount: number;
    categories: string[];
    publishers: string[];
    games: CatalogGame[];
}

const GROUNDING_NOTE =
    'This file is the complete Tailspin Toys catalog. It contains every game the platform lists. ' +
'There are no funding totals, backer counts, player counts, pledge tiers, prices, or release dates in this dataset — ' +
    'do not state any such figures.'

function mapCatalogGame(game: Game): CatalogGame {
    return {
        id: game.id,
        title: game.title,
        description: game.description,
        category: game.category?.name ?? UNKNOWN_CATEGORY,
        publisher: game.publisher?.name ?? UNKNOWN_PUBLISHER,
        ...(game.starRating !== null ? { starRating: game.starRating } : {}),
        ratingLabel: formatStarRating(game.starRating),
    };
}

/**
 * Distinct values sorted by UTF-16 code unit (ordinal, not locale-aware), so the
 * export is byte-identical across environments regardless of the runtime's
 * default locale/ICU data. This is a deterministic order, not a linguistic
 * alphabetical one (e.g. uppercase sorts before lowercase).
 */
function distinctSorted(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Turn data-access results into the agent grounding document. Pure: the same
 * input always produces the same output, regardless of input ordering.
 *
 * Games are sorted by title using ordinal (UTF-16 code unit) comparison, with
 * `id` as a tiebreaker for duplicate titles — not locale-aware alphabetical
 * order — so the export is byte-identical across environments.
 */
export function toCatalogExport(games: Game[]): CatalogExport {
    const entries = games
        .map(mapCatalogGame)
        .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : a.id - b.id));

    return {
        source: 'Tailspin Toys crowdfunding catalog',
        note: GROUNDING_NOTE,
        gameCount: entries.length,
        categories: distinctSorted(entries.map((entry) => entry.category)),
        publishers: distinctSorted(entries.map((entry) => entry.publisher)),
        games: entries,
    };
}

/** Serialize the export with stable formatting and a trailing newline. */
export function serializeCatalogExport(exported: CatalogExport): string {
    return `${JSON.stringify(exported, null, 2)}\n`;
}

/** Read the seeded database and write the grounding file to disk. */
export async function writeCatalogExport(db: Database, outputPath: string = CATALOG_EXPORT_PATH): Promise<CatalogExport> {
    const exported = toCatalogExport(await getAllGames(db));
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, serializeCatalogExport(exported), 'utf-8');
    return exported;
}

// Allow running directly: `tsx db/export-catalog.ts`
if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const db = createDatabase();
    writeCatalogExport(db)
        .then((exported) => {
            console.log(`Exported ${exported.gameCount} games to ${CATALOG_EXPORT_PATH}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('Catalog export failed:', error);
            process.exit(1);
        });
}
