# Add a search box to find games by title

Players who already know what they're looking for shouldn't have to scan the whole catalog. Adding a simple search box on the game list page lets users quickly narrow the list by title, improving discoverability alongside the planned category and publisher filters. This builds on the existing game list data layer without changing the data model.

## Acceptance criteria

- [ ] The game list page includes a search input that filters games by title
- [ ] Matching is case-insensitive and updates the visible list as the user types or submits
- [ ] An appropriate empty state is shown when no games match the search
- [ ] The search input follows the project's accessibility guidelines (labeling, keyboard navigation, visible focus states) and includes a `data-testid` attribute
- [ ] Unit tests cover any new data-layer/search helper and Playwright e2e tests cover the search behavior
