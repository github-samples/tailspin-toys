# Implement pagination on the game list page

As the number of games grows, loading the entire catalog on a single page hurts performance and makes the list harder to browse. Adding pagination keeps the game list page fast and manageable.

## Acceptance criteria

- [ ] The data-access helpers in `src/lib/` support pagination (for example page/limit or cursor-based)
- [ ] The game list page includes pagination controls
- [ ] Pagination controls follow the project's accessibility guidelines and include `data-testid` attributes
- [ ] Vitest unit tests cover the pagination helpers and Playwright e2e tests cover the pagination behavior
