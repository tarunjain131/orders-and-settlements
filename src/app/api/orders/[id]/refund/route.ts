import { NextRequest, NextResponse } from "next/server";
import { createRefund } from "@/lib/orders";
import { refundInputSchema } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";
import { fromCaughtError, unauthorized, validationError } from "@/lib/api-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json();
  const parsed = refundInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const order = await createRefund(Number(id), user.id, parsed.data);
    return NextResponse.json({ order });
  } catch (err) {
    return fromCaughtError(err, "Failed to create refund");
  }
}
