import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";

export async function seedAdminUser() {
  const username = "admin";
  const pin = "1234"; // ilk kurulum; sonra settings ekranından değiştirirsin

  const pinHash = await bcrypt.hash(pin, 10);

  await prisma.user.upsert({
    where: { username },
    update: { pinHash, role: "ADMIN", isActive: true },
    create: { username, pinHash, role: "ADMIN", isActive: true },
  });

  console.log("✅ Admin user hazır: admin / 1234");
}