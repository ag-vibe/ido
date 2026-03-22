import { Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";

import { selectors } from "../../support/selectors.js";
import { CustomWorld } from "../../support/world.js";

async function dragCardToBucket(
  world: CustomWorld,
  title: string,
  bucketId: "today" | "done",
): Promise<void> {
  const card = world.todoCard(title);
  const bucket = world.bucket(bucketId);
  const dataTransfer = await world.page.evaluateHandle(() => new DataTransfer());

  await card.dispatchEvent("dragstart", { dataTransfer });
  await bucket.dispatchEvent("dragover", { dataTransfer });
  await bucket.dispatchEvent("drop", { dataTransfer });
}

When("用户将任务拖到 Today 列", async function (this: CustomWorld) {
  console.log("   📍 Step: 将任务拖到 Today 列...");
  await dragCardToBucket(this, this.lastTodoTitle!, "today");
  console.log("   ✅ 已将任务拖到 Today 列");
});

When("用户将任务拖到 Done 列", async function (this: CustomWorld) {
  console.log("   📍 Step: 将任务拖到 Done 列...");
  await dragCardToBucket(this, this.lastTodoTitle!, "done");
  console.log("   ✅ 已将任务拖到 Done 列");
});

Then("任务应该出现在 Today 列中", async function (this: CustomWorld) {
  console.log("   📍 Step: 验证任务出现在 Today 列...");
  await expect(
    this.bucket("today").locator(selectors.todoCard).filter({ hasText: this.lastTodoTitle! }),
  ).toHaveCount(1);
  console.log("   ✅ 任务位于 Today 列");
});
