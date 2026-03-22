@journey @todo
Feature: Todo 基础操作

  作为已登录用户，我希望能创建和管理任务，
  以便我可以跟踪当天的工作进度

  Background:
    Given 用户已登录系统

  @TODO-CRUD-001 @P0
  Scenario: 用户创建新的待办任务
    When 用户创建一个新的任务
    Then 新任务应该出现在 Later 列中

  @TODO-CRUD-002 @P0
  Scenario: 用户完成一个任务
    Given 用户已创建一个任务
    When 用户将该任务标记为完成
    Then 任务应该出现在 Done 列中

  @TODO-CRUD-003 @P0
  Scenario: 用户删除一个任务
    Given 用户已创建一个任务
    When 用户删除该任务
    Then 任务不应该再出现在看板中

  @TODO-CRUD-004 @P1 @regression
  Scenario: 用户重命名一个任务
    Given 用户已创建一个任务
    When 用户将该任务重命名
    Then 任务标题应该更新
