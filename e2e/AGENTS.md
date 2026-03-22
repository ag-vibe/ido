# E2E Testing Guide

This file applies to everything under `todo/e2e/`.

## Stack

- Use `@cucumber/cucumber` for feature files and step definitions.
- Use `@playwright/test` for browser control and assertions.
- Use `tsx` to run ESM TypeScript entrypoints.
- Keep the app-facing E2E config in `e2e/cucumber.mjs` and `e2e/tsconfig.json`.

## Commands

- Install or update dependencies with `vp add` / `vp install`, not `pnpm`.
- Run cleanup with `vp run e2e:cleanup`.
- Run a dry-run with `vp run e2e:dry-run`.
- Run tests with `vp run e2e:test`.
- For local runs, prefer:
  - `BASE_URL=http://localhost:3001`
  - `API_BASE_URL=http://127.0.0.1:2910/api/v1`

## Recommended Workflow

1. Analyze current coverage.
   - List existing feature files under `e2e/src/features/`.
   - Read `e2e/src/features/todo/README.md` first to see covered journeys and priorities.
   - Inspect the real UI and state flow in `src/components/`, `src/routes/`, and `src/lib/` before adding tests.
2. Choose one user journey to extend.
   - Prefer exactly one new journey per change unless the work is tightly coupled.
   - Follow the priority order `P0 -> P1 -> P2`.
   - Choose core product behavior first, not cosmetic routes.
3. Update the module inventory first.
   - Add or update the row in `e2e/src/features/todo/README.md`.
   - Record feature name, description, priority, status, and target `.feature` file before writing steps.
4. Design the scenario in Gherkin.
   - Write or extend one `.feature` file under `e2e/src/features/todo/`.
   - Keep scenarios in Chinese and use stable tags like `@todo @P1 @TODO-XYZ-001`.
   - Prefer one scenario per user outcome.
5. Implement step definitions and support code.
   - Add or extend step files under `e2e/src/steps/todo/`.
   - Reuse `CustomWorld`, selectors, API helpers, and hooks before inventing new helpers.
   - If the test needs new app anchors, add minimal `data-testid` support in app code.
6. Keep test data and cleanup correct.
   - Use `e2e-` users only.
   - Prefer API sign-up plus seeded localStorage for authenticated setup.
   - If new DB relations are introduced for E2E users, update `e2e/src/support/db-cleanup.ts` in the same change.
7. Validate in the right order.
   - Run `vp run e2e:cleanup` if needed.
   - Run `vp run e2e:dry-run` first to verify feature/step wiring.
   - Run targeted tags next, for example `vp run e2e:test -- --tags "@P0"`.
   - Run the full suite before finishing if shared hooks, selectors, cleanup, or support code changed.
8. Fix failures by tightening determinism.
   - Prefer better selectors and explicit visible-state assertions over long waits.
   - If a failure reveals a real product bug, fix the product bug and keep the test.
   - If a scenario is inherently unstable, do not silently weaken it; document the issue in the README.

## Authoring Rules

- Write `.feature` files in Chinese.
- Keep scenario tags explicit and stable: `@todo`, `@P0`, `@P1`, `@P2`, plus scenario IDs like `@TODO-CRUD-001`.
- Put reusable browser and environment setup in `e2e/src/support/`, not in step files.
- Keep step definitions thin: orchestrate UI actions and assertions, do not duplicate app business logic.
- Add `console.log` step traces for debugging.
- Prefer `data-testid` selectors first, then role/label selectors, and use visible text only when the UI text is intentionally stable.
- When selectors are flaky, add the smallest possible `data-testid` to production UI instead of using brittle CSS traversal.

## Writing Feature Files

- Place feature files under `e2e/src/features/todo/`.
- Prefer one file per functional area, for example:
  - `auth.feature`
  - `crud.feature`
  - `bucket.feature`
  - `offline-sync.feature`
- Prefer one scenario per user outcome. Do not combine multiple unrelated outcomes into one scenario.
- Use product language in steps, not implementation language. Keep DOM details in step definitions.
- Reuse existing step sentences when the behavior is the same. Do not create near-duplicate wording for the same action.

### Recommended Structure

```gherkin
@todo @P0 @TODO-CRUD-001
Feature: Todo 基础操作

  作为已登录用户，我希望能创建和管理任务，
  以便我可以跟踪当天的工作进度

  Background:
    Given 用户已登录系统

  Scenario: 用户创建新的待办任务
    When 用户创建一个新的任务
    Then 新任务应该出现在 Later 列中
```

### Step Writing Rules

- `Feature`: describe one functional area, not the whole app.
- `Background`: use only for shared setup that every scenario in the file needs.
- `Given`: describe state or preconditions.
  - Example: `用户已登录系统`
  - Example: `用户已创建一个任务`
- `When`: describe the user action.
  - Example: `用户将任务拖到 Today 列`
  - Example: `用户在离线状态下创建一个新的任务`
- `Then`: describe visible, user-meaningful outcomes.
  - Example: `任务应该出现在 Done 列中`
  - Example: `页面应该显示待同步状态`

### What To Avoid

- Do not write steps in terms of selectors, components, or DOM events.
  - Avoid: `When 用户点击 data-testid 为 todo-new-input 的输入框`
  - Prefer: `When 用户创建一个新的任务`
- Do not split trivial UI mechanics into many low-value steps unless the interaction itself is the product behavior.
- Do not create different sentences for the same meaning just because the implementation differs.

### Scenario Templates

CRUD template:

```gherkin
@todo @P0 @TODO-CRUD-001
Feature: Todo 基础操作

  作为已登录用户，我希望能创建和管理任务，
  以便我可以跟踪当天的工作进度

  Background:
    Given 用户已登录系统

  Scenario: 用户创建新的待办任务
    When 用户创建一个新的任务
    Then 新任务应该出现在 Later 列中
```

Authenticated edit template:

```gherkin
@todo @P1 @TODO-CRUD-004 @regression
Feature: Todo 重命名任务

  作为已登录用户，我希望能够修改任务标题，
  以便任务名称始终反映当前要做的事情

  Background:
    Given 用户已登录系统
    And 用户已创建一个任务

  Scenario: 用户重命名一个任务
    When 用户将该任务重命名
    Then 任务标题应该更新
```

Offline sync template:

```gherkin
@todo @P2 @TODO-OFFLINE-001 @regression
Feature: Todo 离线同步

  作为已登录用户，我希望离线创建的任务可以在恢复网络后同步，
  以便我在断网时也不会丢失待办记录

  Background:
    Given 用户已登录系统

  Scenario: 用户离线创建任务并在恢复在线后同步
    Given 用户处于离线状态
    When 用户在离线状态下创建一个新的任务
    Then 页面应该显示待同步状态
    When 用户恢复在线状态
    Then 离线创建的任务应该完成同步
```

## Test Data and Isolation

- All synthetic test users must use the `e2e-` prefix.
- Prefer API sign-up plus localStorage session seeding for authenticated scenarios.
- Keep UI login coverage only for the login journey itself.
- Do not share users across scenarios.
- The cleanup contract is part of the suite: `e2e:test` cleans `e2e-*` users, todos, and default-org records before and after the run.
- If you add new server-side relations for E2E users, update `e2e/src/support/db-cleanup.ts`.

## Scenario Scope

- `P0`: login redirect, UI login, create, complete, delete.
- `P1`: rename and drag/drop bucket movement.
- `P2`: offline queue and reconnect sync.
- Do not expand scope casually; add the next user journey only after the existing suite stays green.

## Stability Rules

- Favor deterministic assertions on visible user outcomes.
- Do not assert internal query cache state or request counts unless a test explicitly targets that contract.
- Use unique titles per run with the existing `runId`.
- For offline scenarios, assert both the pending-sync UI and the final persisted state after reload.
- If a failure is caused by environment reachability, fail fast in hooks instead of timing out inside steps.

## Files to Update Together

- New scenarios usually require coordinated updates to:
  - `e2e/src/features/todo/*.feature`
  - `e2e/src/steps/todo/*.steps.ts`
  - `e2e/src/features/todo/README.md`
- If a new selector is added, update the app component and the selector map in `e2e/src/support/selectors.ts`.
- If DB cleanup scope changes, update both `e2e/src/support/db-cleanup.ts` and the README command/behavior notes.
