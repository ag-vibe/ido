import { Given } from "@cucumber/cucumber";

import { signUp, uniqueUser } from "../../support/api.js";
import { selectors } from "../../support/selectors.js";
import { CustomWorld } from "../../support/world.js";

Given("用户已登录系统", async function (this: CustomWorld) {
  console.log("   📍 Step: 通过 API 创建测试用户并注入登录态...");
  const user = uniqueUser("auth");
  const session = await signUp(user);

  this.user = user;
  await this.seedAuthSession(session);
  await this.goto("/");
  await this.expectBoardVisible();

  console.log("   ✅ 已进入任务看板");
});

Given("用户已创建一个任务", async function (this: CustomWorld) {
  console.log("   📍 Step: 创建一个初始任务...");
  const title = `E2E Task ${this.runId}`;
  this.lastTodoTitle = title;

  await this.openNewTaskInput("later");
  await this.bucket("later").locator(selectors.newInput).fill(title);
  await this.bucket("later").locator(selectors.newInput).press("Enter");
  await this.page.locator(selectors.todoCard).filter({ hasText: title }).first().waitFor();

  console.log(`   ✅ 已创建任务 "${title}"`);
});
