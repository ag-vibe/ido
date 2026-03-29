import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";

import { selectors } from "../../support/selectors.js";
import { CustomWorld } from "../../support/world.js";

Given("用户处于离线状态", async function (this: CustomWorld) {
  console.log("   📍 Step: 将浏览器切换到离线状态...");
  await this.context.setOffline(true);
  console.log("   ✅ 浏览器已离线");
});

When("用户在离线状态下创建一个新的任务", async function (this: CustomWorld) {
  console.log("   📍 Step: 离线创建任务...");
  const title = `Offline Task ${this.runId}`;
  this.lastTodoTitle = title;

  await this.openNewTaskInput("later");
  await this.bucket("later").locator(selectors.newInput).fill(title);
  await this.bucket("later").locator(selectors.newInput).press("Enter");
  await expect(
    this.bucket("later").locator(selectors.todoCard).filter({ hasText: title }),
  ).toHaveCount(1);

  console.log(`   ✅ 已离线创建任务 "${title}"`);
});

Then("页面应该显示待同步状态", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证待同步状态...");
  await expect(this.page.locator(selectors.syncStatus)).toContainText("待同步");
  console.log("   ✅ 已显示待同步状态");
});

When("用户恢复在线状态", async function (this: CustomWorld) {
  console.log("   📍 Step: 恢复在线状态...");
  await this.context.setOffline(false);
  console.log("   ✅ 浏览器已恢复在线");
});

Then("离线创建的任务应该完成同步", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证离线任务同步完成...");
  const title = this.lastTodoTitle!;

  await expect(this.page.locator(selectors.syncStatus)).toHaveCount(0);
  await this.page.reload({ waitUntil: "domcontentloaded" });
  await this.expectBoardVisible();
  await expect(
    this.bucket("later").locator(selectors.todoCard).filter({ hasText: title }),
  ).toHaveCount(1);

  console.log("   ✅ 离线任务已完成同步");
});
