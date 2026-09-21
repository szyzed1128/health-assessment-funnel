import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("runs the automated test command on Node 24 LTS or newer", () => {
    const majorVersion = Number(process.versions.node.split(".")[0]);

    expect(majorVersion).toBeGreaterThanOrEqual(24);
  });
});
