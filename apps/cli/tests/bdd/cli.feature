Feature: CLI enforcement
  Scenario: checking a commit message file rejects AI co-authors
    Given a commit message file with an AI co-author
    When I run the CLI check command against that message file
    Then the command exits with code 1
    And stderr contains "[ai-coauthor]"

  Scenario: installing the CLI hook writes a commit-msg hook
    Given an empty git repository
    When I run the CLI install command in that repository
    Then the file ".git/hooks/commit-msg" exists in that repository
