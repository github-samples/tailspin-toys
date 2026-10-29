# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Prospective game backers browsing Tailspin Toys to discover and compare games.

## Product Purpose

Tailspin Toys is a fictional crowdfunding website for developer-themed games. It helps visitors explore the catalog and consider games to back.

## Positioning

Open decision: the repository does not establish a distinct product mechanism or market position.

## Operating Context

The site is a static Astro application. Pages read a local SQLite catalog seeded from `db/games.csv`; catalog entries include publishers, categories, and star ratings.

## Capabilities and Constraints

- The catalog can be ranked by its existing star ratings; equal ratings share a rank.
- The database has no player scores or live backing activity. Do not present ratings as gameplay scores or real-time popularity.
- Catalog data is local and site content is prerendered; there is no separate backend service.

## Brand Commitments

Preserve the Tailspin Toys name and its developer-themed game catalog.

## Evidence on Hand

- `README.md`: product description and static-site architecture.
- `db/games.csv`: seeded game catalog source.
- `db/schema.ts`: game, publisher, category, and star-rating fields.

## Product Principles

- Keep discovery and comparison grounded in catalog data.
- Distinguish game ratings from gameplay scores and backing activity.
- Preserve the reproducible, locally seeded catalog model.
