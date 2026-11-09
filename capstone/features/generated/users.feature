@generated @users
Feature: users API (generated from JSONPlaceholder (subset))

  @generated @getUser
  Scenario: Get a user by id (GET /users/{id})
    Given I set path parameter "id" to "1"
    When I send a GET request to "/users/{id}"
    Then the response status should be 200
    And the response body should match the OpenAPI schema
    And the response JSON property "id" should be of type "number"
    And the response JSON property "name" should be of type "string"
    And the response JSON property "username" should be of type "string"
    And the response JSON property "email" should be of type "string"
