import { describe, expect, it } from "vitest";
import {
  EMPTY_COMPANION_STATE,
  bondCompanionState,
  claimCompanionRitual,
  companionLevel,
  dailyRitualProgress,
  normalizeCompanionState,
  recordCompanionLike,
  rewardCompanionForPlay,
  selectCompanionState,
} from "../src/app/companion";

describe("спутник MYRA", () => {
  it("не начисляет энергию, пока пользователь не выбрал спутника", () => {
    const next = rewardCompanionForPlay(EMPTY_COMPANION_STATE, { id: 1, genre: "Ambient" }, 1000);
    expect(next).toBe(EMPTY_COMPANION_STATE);
  });

  it("дарит первую волну при выборе спутника", () => {
    const next = selectCompanionState(EMPTY_COMPANION_STATE, "luma");
    expect(next.selectedId).toBe("luma");
    expect(next.unlockedGiftIds).toContain("first-wave");
    expect(next.showcasedGiftId).toBe("first-wave");
  });

  it("не позволяет заменить уже связанного спутника", () => {
    const luma = selectCompanionState(EMPTY_COMPANION_STATE, "luma");
    const attemptedChange = selectCompanionState(luma, "spark");

    expect(attemptedChange).toBe(luma);
    expect(attemptedChange.selectedId).toBe("luma");
  });

  it("награждает за новый трек и новый жанр, но не за мгновенный повтор", () => {
    const selected = selectCompanionState(EMPTY_COMPANION_STATE, "echo");
    const first = rewardCompanionForPlay(selected, { id: 7, genre: "Ambient" }, 10_000);
    const repeated = rewardCompanionForPlay(first, { id: 7, genre: "Ambient" }, 11_000);

    expect(first.xp).toBe(28);
    expect(first.playedTrackIds).toEqual([7]);
    expect(first.discoveredGenres).toEqual(["Эмбиент"]);
    expect(repeated.xp).toBe(first.xp);
  });

  it("открывает призму после знакомства с тремя жанрами", () => {
    let state = selectCompanionState(EMPTY_COMPANION_STATE, "spark");
    state = rewardCompanionForPlay(state, { id: 1, genre: "Electronic" }, 1_000);
    state = rewardCompanionForPlay(state, { id: 2, genre: "Hip-Hop" }, 2_000);
    state = rewardCompanionForPlay(state, { id: 3, genre: "Ambient" }, 3_000);

    expect(state.unlockedGiftIds).toContain("genre-prism");
    expect(state.unlockedGiftIds).toContain("discovery-drop");
  });

  it("ежедневная связь начисляется только один раз за период", () => {
    const selected = selectCompanionState(EMPTY_COMPANION_STATE, "luma");
    const first = bondCompanionState(selected, 100_000_000);
    const early = bondCompanionState(first, 100_000_001);

    expect(first.xp).toBe(6);
    expect(early).toBe(first);
  });

  it("завершает ежедневный ритуал только после трёх осмысленных шагов", () => {
    const now = new Date(2026, 6, 18, 12).getTime();
    let state = selectCompanionState(EMPTY_COMPANION_STATE, "echo");
    state = rewardCompanionForPlay(state, { id: 1, genre: "Ambient" }, now);
    state = rewardCompanionForPlay(state, { id: 2, genre: "Ambient" }, now + 1);
    state = rewardCompanionForPlay(state, { id: 3, genre: "Electronic" }, now + 2);

    expect(dailyRitualProgress(state, now)).toMatchObject({ completed: 2, ready: false });

    state = recordCompanionLike(state, now + 3);
    expect(dailyRitualProgress(state, now)).toMatchObject({ completed: 3, ready: true, claimed: false });

    const beforeReward = state.xp;
    state = claimCompanionRitual(state, now + 4);
    expect(state.xp).toBe(beforeReward + 30);
    expect(dailyRitualProgress(state, now)).toMatchObject({ claimed: true });
    expect(claimCompanionRitual(state, now + 5)).toEqual(state);
  });

  it("сбрасывает ритуал на следующий календарный день без потери общей памяти", () => {
    const firstDay = new Date(2026, 6, 18, 12).getTime();
    const nextDay = new Date(2026, 6, 19, 12).getTime();
    let state = selectCompanionState(EMPTY_COMPANION_STATE, "spark");
    state = rewardCompanionForPlay(state, { id: 1, genre: "Pop" }, firstDay);
    state = recordCompanionLike(state, firstDay + 1);
    state = rewardCompanionForPlay(state, { id: 2, genre: "Rock" }, nextDay);

    expect(state.playedTrackIds).toEqual([1, 2]);
    expect(state.daily.trackIds).toEqual([2]);
    expect(state.daily.liked).toBe(false);
  });

  it("восстанавливает безопасное состояние из повреждённого localStorage", () => {
    const state = normalizeCompanionState({
      selectedId: "unknown",
      xp: -50,
      playedTrackIds: [1, "bad", 2],
      unlockedGiftIds: ["first-wave", "fake"],
    });

    expect(state.selectedId).toBeNull();
    expect(state.xp).toBe(0);
    expect(state.playedTrackIds).toEqual([1, 2]);
    expect(state.unlockedGiftIds).toEqual(["first-wave"]);
  });

  it("мигрирует старые английские жанры без дублей после русификации каталога", () => {
    const state = normalizeCompanionState({
      selectedId: "luma",
      discoveredGenres: ["Ambient", "Эмбиент", "Synthwave", "Lo-fi"],
      daily: { date: "2026-07-23", trackIds: [], genres: ["Electronic"], liked: false, claimed: false },
    });

    expect(state.discoveredGenres).toEqual(["Эмбиент", "Синтвейв", "Лоу-фай"]);
    expect(state.daily.genres).toEqual(["Электроника"]);
  });

  it("считает прогресс уровня без выхода за диапазон", () => {
    expect(companionLevel(0)).toMatchObject({ level: 1, progress: 0 });
    expect(companionLevel(60)).toMatchObject({ level: 2, progress: 0 });
    expect(companionLevel(10_000).progress).toBe(1);
  });
});
