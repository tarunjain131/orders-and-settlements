import "dotenv/config";
import { createOrder, recordPayment, createRefund } from "@/lib/orders";

async function main() {
  const o1 = await createOrder({
    customerName: "Priya Sharma",
    customerEmail: "priya.sharma@example.com",
    customerPhone: "+91 98765 43210",
    currency: "INR",
    note: "Please pack in eco-friendly packaging.",
    discountAmount: 0,
    shippingAmount: 60,
    taxAmount: 0,
    lineItems: [
      { title: "Wireless Mouse", sku: "WM-100", quantity: 1, price: 799 },
      { title: "USB-C Cable 1m", sku: "USBC-1M", quantity: 2, price: 249 },
    ],
    initialPayment: 0,
  });
  console.log("Created pending order", o1.name);

  const o2 = await createOrder({
    customerName: "Arjun Mehta",
    customerEmail: "arjun.mehta@example.com",
    customerPhone: "+91 90000 11122",
    currency: "INR",
    note: null,
    discountAmount: 100,
    shippingAmount: 0,
    taxAmount: 45,
    lineItems: [
      { title: "Cotton T-Shirt (M)", sku: "TS-M-BLK", quantity: 3, price: 499 },
    ],
    initialPayment: 1000000, // will be clamped to total by createOrder
  });
  console.log("Created paid order", o2.name);

  const o3 = await createOrder({
    customerName: "Sneha Rao",
    customerEmail: "sneha.rao@example.com",
    customerPhone: null,
    currency: "INR",
    note: "Gift wrap requested",
    discountAmount: 0,
    shippingAmount: 50,
    taxAmount: 0,
    lineItems: [
      { title: "Ceramic Mug", sku: "MUG-01", quantity: 4, price: 349 },
      { title: "Coaster Set", sku: "COAST-01", quantity: 1, price: 299 },
    ],
    initialPayment: 800,
  });
  console.log("Created partially_paid order", o3.name);

  const o4 = await createOrder({
    customerName: "Vikram Singh",
    customerEmail: "vikram.singh@example.com",
    customerPhone: "+91 99887 76655",
    currency: "INR",
    note: null,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    lineItems: [
      { title: "Bluetooth Speaker", sku: "BT-SPK-02", quantity: 1, price: 2499 },
    ],
    initialPayment: 2499,
  });
  await createRefund(o4.id, {
    amount: 2499,
    reason: "Item arrived damaged",
    note: "Full refund issued, customer keeping item.",
    lineItems: [],
  });
  console.log("Created refunded order", o4.name);

  const o5 = await createOrder({
    customerName: "Anita Desai",
    customerEmail: "anita.desai@example.com",
    customerPhone: null,
    currency: "INR",
    note: null,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    lineItems: [{ title: "Notebook Set", sku: "NB-SET", quantity: 2, price: 199 }],
    initialPayment: 0,
  });
  const { voidOrder } = await import("@/lib/orders");
  await voidOrder(o5.id);
  console.log("Created voided order", o5.name);

  console.log("Seeding complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
