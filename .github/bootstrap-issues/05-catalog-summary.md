# Show a catalog summary on the home page

The home page jumps straight into the featured games grid without giving visitors a sense of the catalog's size or quality. Adding a small summary — such as the total number of games and the average star rating — gives backers useful at-a-glance context and makes the landing page feel more alive. This builds entirely on data already available in the data layer.

## Acceptance criteria

- [ ] The home page displays the total number of games in the catalog
- [ ] The home page displays the average star rating across games that have a rating
- [ ] The summary handles edge cases gracefully (no games, or no rated games)
- [ ] The summary follows the project's styling and accessibility guidelines and includes `data-testid` attributes
- [ ] A data-access helper computes the summary deterministically, with unit test coverage, and Playwright e2e tests verify it renders on the home page
