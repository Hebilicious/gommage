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

  Scenario: dry-running a history fix reports the planned rewrite without changing history
    Given a git repository with a commit containing an AI co-author
    When I run the CLI fix command in that repository with dry-run
    Then the command exits with code 0
    And stdout contains "Gommage would rewrite 1 commit(s)."
    And stdout contains "Old author:"
    And stdout contains "New author:"
    And stdout contains "Old message:"
    And stdout contains "New message:"
    And the latest commit message in that repository contains "Co-authored-by: Codex <bot@openai.com>"

  Scenario: fixing history rewrites the offending commit message
    Given a git repository with a commit containing an AI co-author
    When I run the CLI fix command in that repository
    Then the command exits with code 0
    And stdout contains "Gommage rewrote 1 commit(s)."
    And the latest commit message in that repository does not contain "Co-authored-by: Codex <bot@openai.com>"

  Scenario: checking two branch ranges in one run inspects both branches
    Given a git repository with AI co-author commits on two feature branches
    When I run the CLI check command against both feature branch ranges
    Then the command exits with code 1
    And the reported violation count is 2
