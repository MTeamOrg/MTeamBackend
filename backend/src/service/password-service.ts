import bcrypt from "bcrypt";

const BCRYPT_SALT_ROUNDS = 12;

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export interface PasswordComparer {
  compare(plainPassword: string, passwordHash: string): Promise<boolean>;
}

export class PasswordService implements PasswordHasher, PasswordComparer {
  async compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }
}
