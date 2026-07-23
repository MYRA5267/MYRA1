import { beforeEach, describe, expect, it } from "vitest";
import { normalizeGenre, normalizeGenres } from "../src/app/data";
import { getTaste } from "../src/app/smart";

describe("миграция жанров", () => {
  beforeEach(() => localStorage.clear());

  it("приводит старые английские подписи к названиям нового каталога", () => {
    expect(normalizeGenre("Synthwave")).toBe("Синтвейв");
    expect(normalizeGenre("Lo-fi")).toBe("Лоу-фай");
    expect(normalizeGenre("Dream Pop")).toBe("Дрим-поп");
    expect(normalizeGenres(["Ambient", "Эмбиент", "RNB"])).toEqual(["Эмбиент", "R&B"]);
  });

  it("мигрирует сохранённый вкус и записывает нормализованное значение", () => {
    localStorage.setItem("myra.taste", JSON.stringify(["Synthwave", "Ambient", "Эмбиент"]));

    expect([...getTaste()]).toEqual(["Синтвейв", "Эмбиент"]);
    expect(JSON.parse(localStorage.getItem("myra.taste") ?? "[]")).toEqual(["Синтвейв", "Эмбиент"]);
  });
});
