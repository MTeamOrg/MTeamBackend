import bcrypt from "bcrypt";

const BCRYPT_SALT_ROUNDS = 12;

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export class PasswordService implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }
}
