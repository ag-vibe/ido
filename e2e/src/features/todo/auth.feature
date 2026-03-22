@journey @P0 @todo
Feature: Todo 登录流程

  作为用户，我希望系统能正确处理未登录访问和登录成功，
  以便我能进入任务看板开始管理任务

  @TODO-AUTH-001
  Scenario: 未登录用户访问首页时会跳转到登录页
    When 用户访问首页
    Then 应该跳转到登录页

  @TODO-AUTH-002
  Scenario: 用户使用默认账号成功登录
    Given 用户打开登录页
    When 用户使用默认账号登录
    Then 用户应该进入任务看板
