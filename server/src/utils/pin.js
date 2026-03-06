import bcrypt from "bcrypt";

export async function hashPin(pin) {
  const saltRounds = 10;
  return bcrypt.hash(String(pin), saltRounds);
}

export async function verifyPin(pin, hash) {
  return bcrypt.compare(String(pin), String(hash));
}