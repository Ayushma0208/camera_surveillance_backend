import bcrypt from "bcrypt";

const saltRounds = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, saltRounds);

export const verifyPassword = (password: string, passwordHash: string) =>
  bcrypt.compare(password, passwordHash);
