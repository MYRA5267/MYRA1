import { describe, expect, it } from "vitest";
import { parseLyrics } from "../src/app/data";

describe("parseLyrics", () => {
  it("сохраняет строки загруженного автором текста", () => {
    expect(parseLyrics("Первая строка\n\n  Вторая   строка  ")).toEqual([
      { en: ["Первая", "строка"], ru: "" },
      { en: ["Вторая", "строка"], ru: "" },
    ]);
  });

  it("не создаёт пустой текст", () => {
    expect(parseLyrics("   \n ")).toBeNull();
    expect(parseLyrics()).toBeNull();
  });
});
