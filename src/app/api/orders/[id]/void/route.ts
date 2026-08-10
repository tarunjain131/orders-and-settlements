import { NextRequest, NextResponse } from "next/server";
import { voidOrder } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth";
import { fromCaughtError, unauthorized } from "@/lib/api-error";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    const order = await voidOrder(Number(id), user.id);
    return NextResponse.json({ order });
  } catch (err) {
    return fromCaughtError(err, "Failed to void order");
  }
}
