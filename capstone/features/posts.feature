@manual
Feature: Posts API - hand-written scenarios using the generic steps

  Scenario: Filter posts by user
    Given I set query parameter "userId" to "1"
    When I send a GET request to "/posts"
    Then the response status should be 200
    And the response JSON array should not be empty
    And the response JSON property "[0].userId" should equal "1"

  Scenario: Create a post and verify the echoed payload
    Given I set header "Content-Type" to "application/json; charset=UTF-8"
    And I set the request body to:
      """json
      { "title": "hello", "body": "world", "userId": 7 }
      """
    When I send a POST request to "/posts"
    Then the response status should be 201
    And the response JSON property "title" should equal "hello"
    And the response JSON property "userId" should equal "7"
    And the response JSON property "id" should be of type "number"
    And the response body should match the OpenAPI schema

  Scenario: Update a single field by building the body step by step
    Given I set path parameter "id" to "1"
    And I set request body property "id" to "1"
    And I set request body property "title" to "patched title"
    And I set request body property "body" to "patched body"
    And I set request body property "userId" to "1"
    When I send a PUT request to "/posts/{id}"
    Then the response status should be 200
    And the response JSON property "title" should contain "patched"

  Scenario: Nested JSON properties on a user
    Given I set path parameter "id" to "2"
    When I send a GET request to "/users/{id}"
    Then the response status should be 200
    And the response JSON property "address.city" should exist
    And the response JSON property "email" should contain "@"

  Scenario: Unknown resources return 404
    Given I set path parameter "id" to "999999"
    When I send a GET request to "/posts/{id}"
    Then the response status should be 404
