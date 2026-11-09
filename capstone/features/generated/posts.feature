@generated @posts
Feature: posts API (generated from JSONPlaceholder (subset))

  @generated @listPosts
  Scenario: List posts (GET /posts)
    When I send a GET request to "/posts"
    Then the response status should be 200
    And the response body should match the OpenAPI schema
    And the response JSON property "[0].id" should be of type "number"
    And the response JSON property "[0].title" should be of type "string"
    And the response JSON property "[0].body" should be of type "string"
    And the response JSON property "[0].userId" should be of type "number"

  @generated @createPost
  Scenario: Create a post (POST /posts)
    Given I set the request body to:
      """json
      {
        "title": "capstone title",
        "body": "capstone body",
        "userId": 1
      }
      """
    When I send a POST request to "/posts"
    Then the response status should be 201
    And the response body should match the OpenAPI schema
    And the response JSON property "id" should be of type "number"
    And the response JSON property "title" should be of type "string"
    And the response JSON property "body" should be of type "string"
    And the response JSON property "userId" should be of type "number"

  @generated @getPost
  Scenario: Get a post by id (GET /posts/{id})
    Given I set path parameter "id" to "1"
    When I send a GET request to "/posts/{id}"
    Then the response status should be 200
    And the response body should match the OpenAPI schema
    And the response JSON property "id" should be of type "number"
    And the response JSON property "title" should be of type "string"
    And the response JSON property "body" should be of type "string"
    And the response JSON property "userId" should be of type "number"

  @generated @updatePost
  Scenario: Update a post (PUT /posts/{id})
    Given I set path parameter "id" to "1"
    And I set the request body to:
      """json
      {
        "id": 1,
        "title": "updated title",
        "body": "updated body",
        "userId": 1
      }
      """
    When I send a PUT request to "/posts/{id}"
    Then the response status should be 200
    And the response body should match the OpenAPI schema
    And the response JSON property "id" should be of type "number"
    And the response JSON property "title" should be of type "string"
    And the response JSON property "body" should be of type "string"
    And the response JSON property "userId" should be of type "number"

  @generated @deletePost
  Scenario: Delete a post (DELETE /posts/{id})
    Given I set path parameter "id" to "1"
    When I send a DELETE request to "/posts/{id}"
    Then the response status should be 200
