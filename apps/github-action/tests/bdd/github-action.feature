Feature: GitHub Action enforcement
  Scenario: the GitHub Action reports violations for AI co-authors
    Given a git repository with a commit containing an AI co-author
    When I run the GitHub Action against HEAD in that repository
    Then the action exits with code 1
    And the action output "violations" equals "1"
