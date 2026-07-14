import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

export const publishers = sqliteTable('publishers', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    description: text('description'),
});

export const categories = sqliteTable('categories', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    description: text('description'),
});

export const games = sqliteTable('games', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    starRating: real('star_rating'),
    categoryId: integer('category_id')
        .notNull()
        .references(() => categories.id),
    publisherId: integer('publisher_id')
        .notNull()
        .references(() => publishers.id),
});

export type PublisherRow = typeof publishers.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type GameRow = typeof games.$inferSelect;
