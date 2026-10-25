import { test, expect } from "@playwright/test";
const worlds = ["ai-frontier", "research", "open-source", "community", "science", "library", "briefing"];
const names = ["AI 前沿", "研究", "开源", "社区", "科学", "研究库", "每日简报"];
test.beforeEach(async ({ page }) => {
 await page.addInitScript(() => { localStorage.setItem("signal.universe.preferences", JSON.stringify({ paused: true, signals: true, plain: false })); });
});
test("renders the sun and six real worlds and selects each by clicking its WebGL mesh", async ({ page }) => {
 const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
 await page.goto("/"); await expect(page.locator(".universe-canvas canvas")).toBeVisible();
 await expect(page.locator(".universe-status")).toHaveText("选择星球，开始探索");
 await page.screenshot({ path: "screenshots/universe-overview.png" });
 for (const id of worlds) {
   // Return to the panorama before ray-picking the next body.
   if (id !== worlds[0]) { await page.getByRole("button", { name: "SIGNAL，返回宇宙全景" }).click(); await expect(page).toHaveURL(/\/$/); await page.waitForTimeout(1200); }
   const label = page.locator(`[data-world-id="${id}"]`); await expect(label).toBeVisible();
   const center = await label.evaluate((element) => ({ x: Number((element as HTMLElement).dataset.centerX), y: Number((element as HTMLElement).dataset.centerY) }));
   await page.mouse.click(center.x, center.y);
   await expect(page).toHaveURL(new RegExp(`world=${id}`));
   await expect(page.locator("#planet-panel-heading")).toHaveText(names[worlds.indexOf(id)]);
   await page.waitForTimeout(1150);
 }
 await expect(page.locator(".planet-panel")).toBeVisible();
 await expect(page.getByRole("button", { name: "手动更新", exact: true })).toBeVisible();
 await page.screenshot({ path: "screenshots/universe-focus.png" });
 expect(errors).toEqual([]);
});
test("selecting a world opens in-place reading and crops its right hemisphere at the left edge", async ({ page }) => {
 await page.goto("/"); await expect(page.locator(".universe-canvas canvas")).toBeVisible();
 await page.getByRole("button", { name: "打开研究", exact: true }).click(); await expect(page).toHaveURL(/\/\?world=research$/);
 await expect(page.getByRole("search", { name: "搜索当前星球" })).toBeVisible();
 await page.waitForTimeout(1700);
 const label = page.locator('[data-world-id="research"]');
 await expect.poll(async () => Math.abs(await label.evaluate(element => Number((element as HTMLElement).dataset.centerX))), { timeout: 4000 }).toBeLessThan(8);
 await page.getByRole("button", { name: "SIGNAL，返回宇宙全景" }).click(); await expect(page).toHaveURL(/\/$/);
 await expect(page.locator(".planet-panel")).toHaveCount(0);
});
test("keyboard selection, pause controls and existing search remain usable", async ({ page }) => {
 await page.goto("/"); const canvas = page.locator(".universe-canvas canvas"); await expect(canvas).toBeVisible(); await canvas.focus(); await page.keyboard.press("3"); await expect(page.locator("#planet-panel-heading")).toHaveText("开源");
 await page.keyboard.press("Escape"); await expect(page.locator(".planet-panel")).toHaveCount(0);
 await page.getByRole("button", { name: "搜索整个宇宙" }).click(); await expect(page.getByRole("dialog", { name: "搜索情报" })).toBeVisible(); await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("mobile reduced-motion view remains navigable without horizontal overflow", async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/"); await expect(page.locator(".universe-canvas canvas")).toBeVisible();
 await page.getByRole("button", { name: "打开科学", exact: true }).click(); await expect(page.locator("#planet-panel-heading")).toHaveText("科学");
 await expect(page.getByRole("button", { name: "自转已暂停" })).toBeDisabled();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 await page.screenshot({ path: "screenshots/universe-mobile.png", fullPage: true });
});
test("missing WebGL falls back to working normal links", async ({ page }) => {
 await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, name: string, ...args: unknown[]) { if (name.startsWith("webgl")) return null; return original.apply(this, [name, ...args] as Parameters<typeof original>); } as typeof original; });
 await page.goto("/"); await expect(page.getByRole("navigation", { name: "普通板块导航" })).toBeVisible();
 await page.getByRole("navigation", { name: "普通板块导航" }).getByRole("link").nth(3).click(); await expect(page).toHaveURL(/planet=community/);
});
test("statistics errors never fabricate counts or block navigation", async ({ page }) => {
 await page.route("**/api/universe", (route) => route.fulfill({ status: 503, body: "unavailable" }));
 await page.goto("/?world=ai-frontier"); await expect(page.locator(".planet-panel")).toContainText("统计暂时不可用"); await expect(page.locator(".planet-stat-grid dd").first()).toContainText("—"); await expect(page.getByRole("search", { name: "搜索当前星球" })).toBeVisible();
});
test("the server-rendered fallback is navigable without JavaScript", async ({ browser }) => {
 const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage(); await page.goto("http://127.0.0.1:2030/"); await expect(page.getByRole("navigation", { name: "普通板块导航" })).toBeVisible(); await expect(page.getByRole("link", { name: /直接阅读每日简报/ })).toHaveAttribute("href", "/briefing"); await context.close();
});

test("a selected world cannot switch directly by labels, shortcuts or settings", async ({ page }) => {
 await page.goto("/?world=research"); const canvas = page.locator(".universe-canvas canvas"); await expect(canvas).toBeVisible();
 await expect(page.getByRole("button", { name: "打开科学", exact: true })).toBeDisabled();
 await expect(page.getByRole("link", { name: "打开设置" })).toHaveCount(0);
 await expect(page.getByRole("navigation", { name: "六个世界快捷导航" })).toHaveCount(0);
 await canvas.focus(); await page.keyboard.press("3"); await page.keyboard.press("ArrowRight"); await expect(page).toHaveURL(/world=research/);
 await page.keyboard.press("Escape"); await expect(page).toHaveURL(/\/$/);
 await page.getByRole("link", { name: "打开设置" }).click(); await expect(page).toHaveURL(/\/settings$/);
 await expect(page.getByRole("button", { name: "打开导航" })).toHaveCount(0);
 await expect(page.getByRole("button", { name: "展开侧栏" })).toHaveCount(0);
 await expect(page.locator("#main-content")).toContainText("设置");
 await page.getByRole("link", { name: "返回全景", exact: true }).click(); await expect(page).toHaveURL(/\/$/);
 await expect(page.locator(".universe-footer")).toHaveCount(0);
 await expect(page.locator(".universe-intro")).toHaveCount(0); await expect(page.locator(".universe-overview-note")).toHaveCount(0);
});

test("reading articles and related sources keeps the current world open", async ({ page }) => {
 const record = { id: 4321, title: "星球内阅读测试", summary: "真实接口形状的测试摘要", url: "https://example.com/story", sourceName: "测试来源", category: "ai-research", publishedAt: "2026-10-22T03:00:00Z", authors: [], tags: [], importanceScore: 45, keyChange: "方法改进", differences: "", evidence: "实验", limitations: "仍需复现", impact: "降低成本", personalRelevance: "关注研究", oneLineSummary: "摘要", furtherReading: [], isModelRelease: false, modelFamily: null, analyzed: true };
 await page.route("**/api/signals?*", route => route.fulfill({ json: { items: [record], total: 1 } }));
 await page.route("**/api/signals/4321/context", route => route.fulfill({ json: { event: [{ id: 4322, title: "另一份相关来源", summary: "关联内容原地展开", url: "https://example.com/related", sourceName: "来源二", publishedAt: "2026-10-22T03:00:00Z" }], followups: [], scope: "测试关联记录" } }));
 await page.goto("/?world=research"); await page.locator(".reader-items article").first().click();
 await expect(page.getByRole("heading", { name: "星球内阅读测试" })).toBeVisible();
 await page.getByText("另一份相关来源", { exact: true }).click(); await expect(page.getByText("关联内容原地展开", { exact: true })).toBeVisible();
 await expect(page).toHaveURL(/\/\?world=research$/);
 await page.getByRole("button", { name: "返回资讯列表" }).click(); await expect(page.locator(".reader-items article")).toHaveCount(1);
});

test("research library is reachable from the panorama and settings remain dark", async ({ page }) => {
 await page.addInitScript(() => localStorage.setItem("signal.theme", "light"));
 await page.goto("/"); await page.getByRole("button", { name: "打开研究库", exact: true }).click();
 await expect(page.locator("#planet-panel-heading")).toHaveText("研究库");
 await expect(page.getByRole("tab", { name: "已收藏", exact: true })).toBeVisible();
 await page.getByRole("button", { name: "SIGNAL，返回宇宙全景" }).click();
 await page.getByRole("link", { name: "打开设置" }).click();
 await expect(page.getByText("统一使用深色界面。", { exact: true })).toBeVisible();
 await expect(page.getByText("浅色", { exact: true })).toHaveCount(0);
 await expect(page.locator("html")).toHaveClass(/dark/);
 await page.getByRole("link", { name: "返回全景", exact: true }).click();
 await page.getByRole("button", { name: "打开研究", exact: true }).click();
 await page.getByText("这颗星球收录什么？", { exact: true }).click();
 await expect(page.locator(".reader-world-description p")).toContainText("数学、计算机科学");
 await expect(page.getByRole("link", { name: "打开研究库（收藏夹）" })).toHaveCount(0);
});

test("orbital motion and axial spin advance together and both pause", async ({ page }) => {
 await page.goto("/"); await expect(page.locator(".universe-canvas canvas")).toBeVisible(); await page.waitForTimeout(1200);
 const label = page.locator('[data-world-id="ai-frontier"]');
 const snapshot = () => label.evaluate(element => ({ time: Number((element as HTMLElement).dataset.orbitTime), spin: Number((element as HTMLElement).dataset.spin), x: Number((element as HTMLElement).dataset.centerX), y: Number((element as HTMLElement).dataset.centerY) }));
 const start = await snapshot(); await page.getByRole("button", { name: "继续星球自转", exact: true }).click(); await page.waitForTimeout(650);
 const moving = await snapshot(); expect(moving.time).toBeGreaterThan(start.time); expect(moving.spin).toBeGreaterThan(start.spin); expect(Math.hypot(moving.x - start.x, moving.y - start.y)).toBeGreaterThan(.1);
 await page.getByRole("button", { name: "暂停星球自转", exact: true }).click(); await page.waitForTimeout(150);
 const paused = await snapshot(); await page.waitForTimeout(400); const still = await snapshot(); expect(still.time).toBe(paused.time); expect(still.spin).toBe(paused.spin);
});
test("removed analysis pages and backend routes are no longer available", async ({ request }) => {
 for (const path of ["/analysis", "/api/analysis", "/api/models"]) expect((await request.get(path)).status()).toBe(404);
 expect((await request.post("/api/analysis/run")).status()).toBe(404);
});

test("the world-space galaxy follows camera drag and stays still when the paused camera rests", async ({ page }) => {
 await page.emulateMedia({ reducedMotion: "reduce" });
 await page.goto("/"); const canvas = page.locator(".universe-canvas canvas"); await expect(canvas).toBeVisible(); await page.waitForTimeout(1400);
 // This corner contains no planets or controls: only the galaxy and distant stars.
 const clip = { x: 35, y: 125, width: 200, height: 120 };
 const before = await page.screenshot({ clip });
 await page.mouse.move(270, 220); await page.mouse.down(); await page.mouse.move(610, 275, { steps: 18 }); await page.mouse.up(); await page.waitForTimeout(1400);
 const rotated = await page.screenshot({ clip }); expect(before.equals(rotated)).toBe(false);
 await page.waitForTimeout(700); const stationary = await page.screenshot({ clip }); expect(rotated.equals(stationary)).toBe(true);
 await page.screenshot({ path: "screenshots/galaxy-camera-test.png" });
});

test("reading flies the camera to the orbit without moving the planet and centres the sun", async ({ page }) => {
 await page.goto("/"); await expect(page.locator(".universe-canvas canvas")).toBeVisible(); await page.waitForTimeout(1200);
 const planet = page.locator('[data-world-id="research"]');
 const snapshot = () => planet.evaluate(element => ({ x: Number((element as HTMLElement).dataset.worldX), y: Number((element as HTMLElement).dataset.worldY), z: Number((element as HTMLElement).dataset.worldZ), distance: Number((element as HTMLElement).dataset.cameraDistance) }));
 const before = await snapshot(); await page.getByRole("button",{name:"打开研究",exact:true}).click();
 await expect.poll(async()=>Math.abs(await planet.evaluate(element=>Number((element as HTMLElement).dataset.centerX))),{timeout:5000}).toBeLessThan(1);
 const after = await snapshot(); expect(after.x).toBe(before.x); expect(after.y).toBe(before.y); expect(after.z).toBe(before.z); expect(after.distance).toBeLessThan(before.distance);
 const sun = page.locator('[data-world-id="briefing"]');
 const panelLeft = await page.locator(".planet-panel").evaluate(element=>element.getBoundingClientRect().left);
 await expect.poll(async()=>Math.abs(await sun.evaluate(element=>Number((element as HTMLElement).dataset.centerX))-panelLeft/2)).toBeLessThan(1);
 await page.getByRole("button", {name:"继续星球自转",exact:true}).click(); await page.waitForTimeout(650);
 const tracked = await snapshot(); expect(Math.hypot(tracked.x-after.x,tracked.y-after.y,tracked.z-after.z)).toBeGreaterThan(.01);
 expect(Math.abs(await planet.evaluate(element=>Number((element as HTMLElement).dataset.centerX)))).toBeLessThan(1);
 expect(Math.abs(await sun.evaluate(element=>Number((element as HTMLElement).dataset.centerX))-panelLeft/2)).toBeLessThan(1);
});

test("the reading panel waits for actual camera arrival and cancelling a flight never reveals stale text", async ({ page }) => {
 await page.goto("/"); const scene = page.locator(".universe-canvas"); await expect(scene.locator("canvas")).toBeVisible();
 await page.getByRole("button", { name: "打开研究库", exact: true }).click(); await expect(page).toHaveURL(/world=library/);
 await expect(scene).toHaveAttribute("data-flight", "flying"); await expect(page.locator(".planet-panel")).toHaveCount(0);
 await page.getByRole("button", { name: "SIGNAL，返回宇宙全景" }).click(); await expect(page).toHaveURL(/\/$/); await page.waitForTimeout(2300);
 await expect(page.locator(".planet-panel")).toHaveCount(0);
 await page.getByRole("button", { name: "打开研究", exact: true }).click(); await expect(page).toHaveURL(/world=research/);
 await expect(scene).toHaveAttribute("data-flight", "flying"); await expect(page.locator(".planet-panel")).toHaveCount(0);
 await expect(scene).toHaveAttribute("data-flight", "arrived"); await expect(page.locator("#planet-panel-heading")).toHaveText("研究");
 expect(Math.abs(await page.locator('[data-world-id="research"]').evaluate(element=>Number((element as HTMLElement).dataset.centerX)))).toBeLessThan(1);
});

test("spacecraft automatically follows selected planets without flight controls", async ({page})=>{
 await page.goto("/");const marker=page.locator(".spacecraft-state");
 await expect(marker).toHaveAttribute("data-target","ai-frontier");await expect(marker).toHaveAttribute("data-phase","orbiting");
 await expect(page.locator(".spacecraft-controls, .spacecraft-marker, .spacecraft-panel")).toHaveCount(0);
 const position=()=>marker.evaluate(element=>({x:Number((element as HTMLElement).dataset.x),y:Number((element as HTMLElement).dataset.y),z:Number((element as HTMLElement).dataset.z)}));
 const start=await position();await page.getByRole("button",{name:"继续星球自转",exact:true}).click();
 await expect.poll(async()=>{const p=await position();return Math.hypot(p.x-start.x,p.y-start.y,p.z-start.z);}).toBeGreaterThan(.1);
 await page.getByRole("button",{name:"暂停星球自转",exact:true}).click();await page.waitForTimeout(150);
 const paused=await position();await page.waitForTimeout(300);expect(await position()).toEqual(paused);
 await page.locator("canvas").focus();await page.keyboard.press("2");await expect(marker).toHaveAttribute("data-target","research");
 await page.getByRole("button",{name:"返回全景",exact:true}).click();await expect(page).toHaveURL(/\/$/);
 await expect(marker).toHaveAttribute("data-target","research");
 await page.locator("canvas").focus();await page.keyboard.press("5");await expect(marker).toHaveAttribute("data-target","science");
 await expect(page.getByRole("button",{name:/飞船控制|手动驾驶|打开飞船控制/})).toHaveCount(0);
});
test("mobile deep links set the automatic spacecraft destination without controls",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/?world=library");
 await expect(page.locator(".spacecraft-state")).toHaveAttribute("data-target","library");
 await expect(page.locator(".spacecraft-controls, .spacecraft-marker, .spacecraft-panel")).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
