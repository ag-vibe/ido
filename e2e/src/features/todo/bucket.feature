@regression @todo
Feature: Todo 拖拽分栏

  作为已登录用户，我希望可以通过拖拽整理任务，
  以便我按优先级安排工作

  Background:
    Given 用户已登录系统
    And 用户已创建一个任务

  @TODO-BUCKET-001 @P1
  Scenario: 用户将任务从 Later 拖到 Today
    When 用户将任务拖到 Today 列
    Then 任务应该出现在 Today 列中

  @TODO-BUCKET-002 @P1
  Scenario: 用户将任务拖到 Done 列
    When 用户将任务拖到 Done 列
    Then 任务应该出现在 Done 列中
