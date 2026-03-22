import { Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";

import { selectors } from "../../support/selectors.js";
import { CustomWorld } from "../../support/world.js";

When("用户创建一个新的任务", async function (this: CustomWorld) {
  console.log("   📍 Step: 创建一个新任务...");
  const title = `E2E Task ${this.runId}`;
  this.lastTodoTitle = title;

  await this.page.locator(selectors.newInput).fill(title);
  await this.page.locator(selectors.newInput).press("Enter");

  console.log(`   ✅ 已提交任务 "${title}"`);
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

Then("新任务应该出现在 Later 列中", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务出现在 Later 列...");
  const title = this.lastTodoTitle!;
  await expect(
    this.bucket("later").locator(selectors.todoCard).filter({ hasText: title }),
  ).toHaveCount(1);
  console.log("   ✅ 新任务位于 Later 列");
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
