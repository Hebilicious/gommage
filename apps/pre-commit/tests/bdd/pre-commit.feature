Feature: Pre-commit enforcement
  Scenario: the pre-commit hook rejects AI co-authors
    Given a commit message file with an AI co-author
    When I run the pre-commit hook against that message file
    Then the command exits with code 1
    And stderr contains "ai-coauthor"
