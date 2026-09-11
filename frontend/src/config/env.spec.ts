import { describe, it, expect } from "vitest";
import { validateFrontendEnv } from "./env";

describe("Frontend Environment Validation", () => {
  it("should validate and return environment variables without throwing", () => {
    expect(() => validateFrontendEnv()).not.toThrow();
    const validated = validateFrontendEnv();
    expect(validated).toBeDefined();
    expect(typeof validated.MODE).toBe("string");
  });
});
