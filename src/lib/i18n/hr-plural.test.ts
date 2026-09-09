import { describe, expect, it } from "vitest";
import { hrPlural } from "./translations";

const res = (n: number) => hrPlural(n, "rezervacija", "rezervacije", "rezervacija");

describe("hrPlural", () => {
  it("takes the singular for numbers ending in 1, except the teens", () => {
    for (const n of [1, 21, 31, 101, 121]) expect(hrPlural(n, "one", "few", "many"), String(n)).toBe("one");
    expect(hrPlural(11, "one", "few", "many")).toBe("many");
    expect(hrPlural(111, "one", "few", "many")).toBe("many");
  });

  it("takes the paucal for 2-4, except the teens", () => {
    for (const n of [2, 3, 4, 22, 23, 24, 102]) expect(hrPlural(n, "one", "few", "many"), String(n)).toBe("few");
    for (const n of [12, 13, 14, 112]) expect(hrPlural(n, "one", "few", "many"), String(n)).toBe("many");
  });

  it("takes the genitive plural for zero and for 5 and up", () => {
    for (const n of [0, 5, 6, 9, 10, 25, 100]) expect(hrPlural(n, "one", "few", "many"), String(n)).toBe("many");
  });

  it("gets the counts the reports page actually shows right", () => {
    // "Nepoznat iznos: 0 rezervacija" — the bug this helper replaces
    // rendered "0 rezervacije".
    expect(res(0)).toBe("rezervacija");
    expect(res(1)).toBe("rezervacija");
    expect(res(2)).toBe("rezervacije");
    expect(res(6)).toBe("rezervacija");
    expect(res(22)).toBe("rezervacije");
  });

  it("lets a word with one plural form pass the same string twice", () => {
    const night = (n: number) => hrPlural(n, "noć", "noći", "noći");
    expect(night(1)).toBe("noć");
    expect(night(3)).toBe("noći");
    expect(night(7)).toBe("noći");
  });

  it("ignores the sign", () => {
    expect(hrPlural(-1, "one", "few", "many")).toBe("one");
    expect(hrPlural(-3, "one", "few", "many")).toBe("few");
  });
});
