import { Given, Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";

import { selectors } from "../../support/selectors.js";
import { CustomWorld } from "../../support/world.js";

Given("用户打开登录页", async function (this: CustomWorld) {
  console.log("   📍 Step: 打开登录页...");
  await this.goto("/login");
  console.log("   ✅ 登录页已打开");
});

When("用户访问首页", async function (this: CustomWorld) {
  console.log("   📍 Step: 访问首页...");
  await this.goto("/");
  console.log("   ✅ 已访问首页");
});

When("用户使用默认账号登录", async function (this: CustomWorld) {
  console.log("   📍 Step: 使用默认账号执行登录...");
  await this.page.getByLabel("Name").fill("test");
  await this.page.getByLabel("Password").fill("test");
  await this.page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await this.page.locator(selectors.board).waitFor();
  console.log("   ✅ 默认账号登录成功");
});

Then("应该跳转到登录页", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证当前页面为登录页...");
  await expect(this.page).toHaveURL(/\/login$/);
  await expect(this.page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  console.log("   ✅ 已跳转到登录页");
});

Then("用户应该进入任务看板", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务看板已显示...");
  await expect(this.page).toHaveURL(/\/$/);
  await expect(this.page.locator(selectors.board)).toBeVisible();
  console.log("   ✅ 任务看板已显示");
});
