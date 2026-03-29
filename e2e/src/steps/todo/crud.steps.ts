import { Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";

import { selectors } from "../../support/selectors.js";
import { CustomWorld } from "../../support/world.js";

When("用户创建一个新的任务", async function (this: CustomWorld) {
  console.log("   📍 Step: 创建一个新任务...");
  const title = `E2E Task ${this.runId}`;
  this.lastTodoTitle = title;

  await this.openNewTaskInput("later");
  await this.bucket("later").locator(selectors.newInput).fill(title);
  await this.bucket("later").locator(selectors.newInput).press("Enter");

  console.log(`   ✅ 已提交任务 "${title}"`);
});

When("用户在 Today 列创建一个新的任务", async function (this: CustomWorld) {
  console.log("   📍 Step: 在 Today 列创建一个新任务...");
  const title = `Today Task ${this.runId}`;
  this.lastTodoTitle = title;

  await this.openNewTaskInput("today");
  await this.bucket("today").locator(selectors.newInput).fill(title);
  await this.bucket("today").locator(selectors.newInput).press("Enter");

  console.log(`   ✅ 已在 Today 列提交任务 "${title}"`);
});

When("用户将该任务标记为完成", async function (this: CustomWorld) {
  console.log("   📍 Step: 将任务标记为完成...");
  const title = this.lastTodoTitle!;
  await this.todoCard(title).locator(selectors.todoToggle).click();
  console.log("   ✅ 已标记任务完成");
});

When("用户删除该任务", async function (this: CustomWorld) {
  console.log("   📍 Step: 删除任务...");
  const title = this.lastTodoTitle!;
  const card = this.todoCard(title);
  await card.hover();
  await card.locator(selectors.todoDelete).click();
  console.log("   ✅ 已删除任务");
});

When("用户将该任务重命名", async function (this: CustomWorld) {
  console.log("   📍 Step: 重命名任务...");
  const originalTitle = this.lastTodoTitle!;
  const nextTitle = `${originalTitle} Renamed`;

  await this.todoCard(originalTitle).locator(selectors.todoTitle).dblclick();
  await this.page.locator(selectors.todoTitleInput).fill(nextTitle);
  await this.page.locator(selectors.todoTitleInput).press("Enter");

  this.lastTodoTitle = nextTitle;
  console.log(`   ✅ 已重命名为 "${nextTitle}"`);
});

When("用户通过 Tab 为该任务添加描述", async function (this: CustomWorld) {
  console.log("   📍 Step: 通过 Tab 打开并填写描述...");
  const title = this.lastTodoTitle!;
  const description = `Description ${this.runId}`;
  this.lastTodoDescription = description;

  await this.todoCard(title).locator(selectors.todoTitle).dblclick();
  await this.page.locator(selectors.todoTitleInput).press("Tab");
  await expect(this.page.locator(selectors.todoDescriptionInput)).toBeVisible();
  await this.page.locator(selectors.todoDescriptionInput).fill(description);
  await this.page.locator(selectors.todoDescriptionInput).press("Enter");

  console.log(`   ✅ 已填写描述 "${description}"`);
});

When("用户通过 Tab 打开描述后直接保存", async function (this: CustomWorld) {
  console.log("   📍 Step: 打开描述输入后直接回车保存...");
  const title = this.lastTodoTitle!;

  await this.todoCard(title).locator(selectors.todoTitle).dblclick();
  await this.page.locator(selectors.todoTitleInput).press("Tab");
  await expect(this.page.locator(selectors.todoDescriptionInput)).toBeVisible();
  await this.page.locator(selectors.todoDescriptionInput).press("Enter");

  console.log("   ✅ 已保存空描述");
});

Then("新任务应该出现在 Later 列中", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务出现在 Later 列...");
  const title = this.lastTodoTitle!;
  await expect(
    this.bucket("later").locator(selectors.todoCard).filter({ hasText: title }),
  ).toHaveCount(1);
  console.log("   ✅ 新任务位于 Later 列");
});

Then("新任务应该出现在 Today 列中", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务出现在 Today 列...");
  const title = this.lastTodoTitle!;
  await expect(
    this.bucket("today").locator(selectors.todoCard).filter({ hasText: title }),
  ).toHaveCount(1);
  console.log("   ✅ 新任务位于 Today 列");
});

Then("任务应该出现在 Done 列中", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务出现在 Done 列...");
  const title = this.lastTodoTitle!;
  await expect(
    this.bucket("done").locator(selectors.todoCard).filter({ hasText: title }),
  ).toHaveCount(1);
  console.log("   ✅ 任务位于 Done 列");
});

Then("任务不应该再出现在看板中", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务已从看板移除...");
  const title = this.lastTodoTitle!;
  await expect(this.page.locator(selectors.todoCard).filter({ hasText: title })).toHaveCount(0);
  console.log("   ✅ 任务已从看板移除");
});

Then("任务标题应该更新", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务标题已更新...");
  const title = this.lastTodoTitle!;
  await expect(this.page.locator(selectors.todoCard).filter({ hasText: title })).toHaveCount(1);
  console.log(`   ✅ 任务标题已更新为 "${title}"`);
});

Then("任务描述应该更新", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务描述已更新...");
  const title = this.lastTodoTitle!;
  const description = this.lastTodoDescription!;
  await expect(this.todoCard(title).locator(selectors.todoDescription)).toHaveText(description);
  console.log(`   ✅ 任务描述已更新为 "${description}"`);
});

Then("任务不应该显示描述", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务未显示描述...");
  const title = this.lastTodoTitle!;
  await expect(this.todoCard(title).locator(selectors.todoDescription)).toHaveCount(0);
  console.log("   ✅ 任务没有显示描述");
});
