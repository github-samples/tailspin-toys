# Show category and publisher descriptions on the game detail page

The categories and publishers tables already include a `description` field, but the game detail page only shows their names. Surfacing these descriptions gives backers helpful context about who is behind a game and what kind of game it is, with no schema changes required.

## Acceptance criteria

- [ ] The game detail page displays the category description when one is available
- [ ] The game detail page displays the publisher description when one is available
- [ ] Missing descriptions are handled gracefully (the section is hidden rather than showing empty content)
- [ ] The new content follows the project's styling and accessibility guidelines and includes `data-testid` attributes
- [ ] The data-access helper is updated to include the description fields, with unit tests covering the change, and Playwright e2e tests verify the descriptions render
