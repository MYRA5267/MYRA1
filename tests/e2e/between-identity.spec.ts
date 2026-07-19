import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("myra.onboarded", "true"));
});

test("Между открывается из основной навигации", async ({ page }) => {
  await page.goto("/");

  const nav = page.locator(".myra-mobile-nav");
  await nav.getByRole("button", { name: "Между" }).click();

  const hero = page.locator(".myra-between-hero");
  await expect(hero.getByText("МУЗЫКА МЕЖДУ НАМИ")).toBeVisible();
  await expect(hero.getByRole("heading", { name: "Не просто слушай. Окажись внутри." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Рядом" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Открыть" })).toBeVisible();
});

test("коллекция профиля разделяет артефакты, знаки и подарки", async ({ page }) => {
  await page.goto("/");

  const nav = page.locator(".myra-mobile-nav");
  await nav.getByRole("button", { name: "Профиль" }).click();
  await page.getByRole("button", { name: /Твоя музыкальная коллекция/ }).click();

  await expect(page.getByRole("heading", { name: "Твоя коллекция" })).toBeVisible();
  await page.getByRole("tab", { name: "Знаки" }).click();
  await expect(page.getByText("Знаки видны вокруг аватара")).toBeVisible();
  await page.getByRole("tab", { name: "Подарки" }).click();
  await expect(page.getByText("Подарки — от людей, не от алгоритма")).toBeVisible();
});

test("старый localStorage-флаг не открывает панель команды", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("myra.devMode", "true"));
  await page.goto("/");

  const nav = page.locator(".myra-mobile-nav");
  await nav.getByRole("button", { name: "Профиль" }).click();
  await expect(page.getByRole("button", { name: "Панель разработчика" })).toHaveCount(0);
});
