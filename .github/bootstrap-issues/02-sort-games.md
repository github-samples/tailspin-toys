# Allow users to sort the game list

Different players browse in different ways — some want the highest-rated titles first, others prefer alphabetical order. Adding sorting options to the game list page gives backers more control over how they explore the catalog. The data layer already exposes title and star rating, so this builds on existing structures.

## Acceptance criteria

- [ ] Users can sort the game list by title (A–Z and Z–A)
- [ ] Users can sort the game list by star rating (highest first)
- [ ] Games without a star rating are ordered in a sensible, documented way when sorting by rating
- [ ] The sort control follows the project's accessibility guidelines (labeling, keyboard navigation, visible focus states) and includes a `data-testid` attribute
- [ ] Unit tests cover the sorting helper(s) and Playwright e2e tests cover the sorting behavior
