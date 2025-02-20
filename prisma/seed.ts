import { PrismaClient } from "@prisma/client";
import { users, customers, invoices } from "../app/lib/placeholder-data";

import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        password: bcrypt.hashSync(user.password, 10),
      },
    });
  }

  for (const customer of customers) {
    await prisma.customer.create({
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        image_url: customer.image_url,
      },
    });
  }

  for (const invoice of invoices) {
    await prisma.invoice.create({
      data: {
        customer_id: invoice.customer_id,
        amount: invoice.amount,
        status: invoice.status,
        date: new Date(invoice.date),
      },
    });
  }

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
