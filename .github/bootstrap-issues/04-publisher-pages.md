# Add a publisher page listing that publisher's games

When a backer likes a game, a natural next step is to see what else the same publisher has made. Adding a dedicated, prerendered page for each publisher that lists their games improves catalog navigation. The data model already links games to publishers, so this is a focused addition that follows the existing dynamic-route pattern used for game detail pages.

## Acceptance criteria

- [ ] Each publisher has a prerendered page (using `getStaticPaths()` + `export const prerender = true`) listing all of their games
- [ ] The page shows the publisher name and description, and reuses the existing game card for the listing
- [ ] Publisher names on the game card and/or game detail page link to the publisher page
- [ ] The page follows the project's styling and accessibility guidelines and includes `data-testid` attributes
- [ ] A data-access helper returns games for a given publisher with unit test coverage, and Playwright e2e tests cover the publisher page
