import { NextRequest, NextResponse } from "next/server";
import { createOrder, listOrders } from "@/lib/orders";
import { orderInputSchema } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";
import { fromCaughtError, unauthorized, validationError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const status = searchParams.get("status") || undefined;
  const data = await listOrders(user.id, { q, status });
  return NextResponse.json({ orders: data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const order = await createOrder(user.id, parsed.data);
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    return fromCaughtError(err, "Failed to create order");
  }
}
