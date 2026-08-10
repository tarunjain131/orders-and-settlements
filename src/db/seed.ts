import "dotenv/config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { createOrder, createRefund } from "@/lib/orders";

const SEED_EMAIL = "demo@example.com";
const SEED_PASSWORD = "password123";

async function main() {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const [seedUser] = await db
    .insert(users)
    .values({ email: SEED_EMAIL, passwordHash })
    .returning();

  console.log("Created seed user:");
  console.log(`  email:    ${SEED_EMAIL}`);
  console.log(`  password: ${SEED_PASSWORD}`);

  const userId = seedUser.id;

  const o1 = await createOrder(userId, {
    customerName: "Priya Sharma",
    customerEmail: "priya.sharma@example.com",
    customerPhone: "+91 98765 43210",
    currency: "INR",
    description: "Please pack in eco-friendly packaging.",
    dueDate: "2026-08-17",
    lineItems: [
      { description: "Wireless Mouse", sku: "WM-100", quantity: 1, price: 799 },
      { description: "USB-C Cable 1m", sku: "USBC-1M", quantity: 2, price: 249 },
    ],
    initialPayment: 0,
  });
  console.log("Created pending order", o1.name);

  const o2 = await createOrder(userId, {
    customerName: "Arjun Mehta",
    customerEmail: "arjun.mehta@example.com",
    customerPhone: "+91 90000 11122",
    currency: "INR",
    description: null,
    dueDate: "2026-08-17",
    lineItems: [
      { description: "Cotton T-Shirt (M)", sku: "TS-M-BLK", quantity: 3, price: 499 },
    ],
    initialPayment: 1000000, // will be clamped to total by createOrder
  });
  console.log("Created paid order", o2.name);

  const o3 = await createOrder(userId, {
    customerName: "Sneha Rao",
    customerEmail: "sneha.rao@example.com",
    customerPhone: null,
    currency: "INR",
    description: "Gift wrap requested",
    dueDate: "2026-08-17",
    lineItems: [
      { description: "Ceramic Mug", sku: "MUG-01", quantity: 4, price: 349 },
      { description: "Coaster Set", sku: "COAST-01", quantity: 1, price: 299 },
    ],
    initialPayment: 800,
  });
  console.log("Created partially_paid order", o3.name);

  const o4 = await createOrder(userId, {
    customerName: "Vikram Singh",
    customerEmail: "vikram.singh@example.com",
    customerPhone: "+91 99887 76655",
    currency: "INR",
    description: null,
    dueDate: "2026-08-17",
    lineItems: [
      { description: "Bluetooth Speaker", sku: "BT-SPK-02", quantity: 1, price: 2499 },
    ],
    initialPayment: 2499,
  });
  await createRefund(o4.id, userId, {
    amount: 2499,
    reason: "Item arrived damaged",
    note: "Full refund issued, customer keeping item.",
    lineItems: [],
  });
  console.log("Created refunded order", o4.name);

  const o5 = await createOrder(userId, {
    customerName: "Anita Desai",
    customerEmail: "anita.desai@example.com",
    customerPhone: null,
    currency: "INR",
    description: null,
    dueDate: "2026-08-17",
    lineItems: [{ description: "Notebook Set", sku: "NB-SET", quantity: 2, price: 199 }],
    initialPayment: 0,
  });
  const { voidOrder } = await import("@/lib/orders");
  await voidOrder(o5.id, userId);
  console.log("Created voided order", o5.name);

  console.log("Seeding complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
