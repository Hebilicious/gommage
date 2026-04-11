Feature: GitHub App evaluation
  Scenario: the GitHub App helper fails a violating pull request
    Given a pull request payload with an AI co-author commit
    When I evaluate the payload with the GitHub App helper
    Then the GitHub App conclusion is "failure"
    And the GitHub App summary contains "1 violation"
