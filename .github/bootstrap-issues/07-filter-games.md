# Allow users to filter games by category and publisher

As the game catalog grows, players need a faster way to find titles relevant to them. Adding the ability to filter the game list by category and by publisher improves discoverability and directly supports the platform's goal of helping backers find games to support. The data model already includes categories and publishers, so this builds on existing structures.

## Acceptance criteria

- [ ] Users can filter the game list by one or more categories
- [ ] Users can filter the game list by publisher
- [ ] Category and publisher filters can be combined
- [ ] The data-access helpers in `src/lib/` support filtering games by category and publisher
- [ ] Filter controls follow the project's accessibility guidelines (keyboard navigation, ARIA, visible focus states) and include `data-testid` attributes
- [ ] Vitest unit tests cover the filtering helpers and Playwright e2e tests cover the new filtering behavior
