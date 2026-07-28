import argon2 from "argon2";

export const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$+7Z8qtVSJFUbwiZ6HRDODA$1QtcYd7qSO9Bzam5KXNmO+br4N4bzDwRED9Pm9Cgnyw";

function isArgon2Hash(passwordHash: string | undefined): passwordHash is string {
  return Boolean(passwordHash?.match(/^\$argon2(?:id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[^$]+\$[^$]+$/));
}

export async function verifyPassword(passwordHash: string | undefined, password: string) {
  try {
    return await argon2.verify(isArgon2Hash(passwordHash) ? passwordHash : DUMMY_PASSWORD_HASH, password);
  } catch {
    return false;
  }
}
