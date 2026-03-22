@regression @todo @P2
Feature: Todo 离线同步

  作为已登录用户，我希望离线创建的任务可以在恢复网络后同步，
  以便我在断网时也不会丢失待办记录

  Background:
    Given 用户已登录系统

  @TODO-OFFLINE-001
  Scenario: 用户离线创建任务并在恢复在线后同步
    Given 用户处于离线状态
    When 用户在离线状态下创建一个新的任务
    Then 页面应该显示待同步状态
    When 用户恢复在线状态
    Then 离线创建的任务应该完成同步
