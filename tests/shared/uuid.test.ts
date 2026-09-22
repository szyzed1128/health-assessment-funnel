import { describe, expect, it } from "vitest";

import { createUuidV4 } from "@/shared/uuid";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createUuidV4", () => {
  it("uses native randomUUID when available", () => {
    const uuid = "36f863a2-5472-455f-94e6-bd5068799a88";

    expect(createUuidV4({ randomUUID: () => uuid })).toBe(uuid);
  });

  it("creates a valid UUID v4 when randomUUID is unavailable", () => {
    const uuid = createUuidV4({
      getRandomValues(array) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let index = 0; index < bytes.length; index += 1) {
          bytes[index] = index;
        }
        return array;
      },
    });

    expect(uuid).toMatch(uuidV4Pattern);
    expect(uuid).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("fails clearly when no secure random API is available", () => {
    expect(() => createUuidV4({})).toThrow("当前浏览器不支持安全随机数生成");
  });
});
