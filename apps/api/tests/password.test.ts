import { beforeEach, describe, expect, it, vi } from "vitest";

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));

vi.mock("argon2", () => ({ default: { verify } }));

import { DUMMY_PASSWORD_HASH, verifyPassword } from "../src/modules/auth/password.js";

describe("verifyPassword", () => {
  beforeEach(() => {
    verify.mockReset();
    verify.mockResolvedValue(false);
  });

  it.each([undefined, "not-a-valid-hash", "$argon2id$malformed"]) (
    "uses one dummy verification for missing or malformed hashes (%s)",
    async (passwordHash) => {
      await verifyPassword(passwordHash, "CorrectHorseBattery1!");

      expect(verify).toHaveBeenCalledTimes(1);
      expect(verify).toHaveBeenCalledWith(DUMMY_PASSWORD_HASH, "CorrectHorseBattery1!");
    },
  );

  it("uses one verification for a real Argon2 hash", async () => {
    verify.mockResolvedValueOnce(true);

    await expect(verifyPassword(DUMMY_PASSWORD_HASH, "CorrectHorseBattery1!")).resolves.toBe(true);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(DUMMY_PASSWORD_HASH, "CorrectHorseBattery1!");
  });

  it("returns false for malformed hashes instead of throwing", async () => {
    verify.mockRejectedValueOnce(new Error("invalid hash"));

    await expect(verifyPassword("not-a-valid-hash", "CorrectHorseBattery1!")).resolves.toBe(false);
  });
});
