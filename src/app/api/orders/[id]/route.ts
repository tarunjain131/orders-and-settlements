import { NextRequest, NextResponse } from "next/server";
import { deleteOrder, getOrder, updateOrder } from "@/lib/orders";
import { orderInputSchema } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";
import { apiError, fromCaughtError, unauthorized, validationError } from "@/lib/api-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const order = await getOrder(Number(id), user.id);
  if (!order) return apiError("Order not found", 404, { code: "not_found" });
  return NextResponse.json({ order });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json();
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const order = await updateOrder(Number(id), user.id, parsed.data);
    return NextResponse.json({ order });
  } catch (err) {
    return fromCaughtError(err, "Failed to update order");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    await deleteOrder(Number(id), user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return fromCaughtError(err, "Failed to delete order");
  }
}
