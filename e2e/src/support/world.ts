import { World, setWorldConstructor } from "@cucumber/cucumber";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { IWorldOptions } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { AuthSession, E2EUser } from "./api.js";
import { e2eEnv } from "./env.js";
import { selectors } from "./selectors.js";

export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  runId: string;
  session?: AuthSession;
  user?: E2EUser;
  lastTodoTitle?: string;
  lastTodoDescription?: string;

  constructor(options: IWorldOptions) {
    super(options);
    this.runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async goto(pathname: string): Promise<void> {
    await this.page.goto(new URL(pathname, e2eEnv.baseUrl).toString(), {
      waitUntil: "domcontentloaded",
    });
  }

  async seedAuthSession(session: AuthSession): Promise<void> {
    this.session = session;
    await this.context.addInitScript((value) => {
      window.localStorage.setItem("flodo.auth.v1", JSON.stringify(value));
    }, session);
  }

  todoCard(title: string) {
    return this.page.locator(selectors.todoCard).filter({ hasText: title }).first();
  }

  bucket(bucketId: "later" | "week" | "today" | "done") {
    return this.page.locator(selectors.bucket(bucketId));
  }

  async expectBoardVisible(): Promise<void> {
    await expect(this.page.locator(selectors.board)).toBeVisible();
  }

  screenshotPath(featureName: string, scenarioName: string): string {
    const safe = `${featureName}-${scenarioName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return path.join(process.cwd(), "e2e", "artifacts", "screenshots", `${safe}-${Date.now()}.png`);
  }

  async ensureArtifactsDir(): Promise<void> {
    await mkdir(path.join(process.cwd(), "e2e", "artifacts", "screenshots"), { recursive: true });
  }
}

setWorldConstructor(CustomWorld);
