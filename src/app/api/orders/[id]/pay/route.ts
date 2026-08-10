import { NextRequest, NextResponse } from "next/server";
import { recordPayment } from "@/lib/orders";
import { paymentInputSchema } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = paymentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }
  try {
    const order = await recordPayment(
      Number(id),
      parsed.data.amount,
      parsed.data.note
    );
    return NextResponse.json({ order });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message || "Failed to record payment" },
      { status }
    );
  }
}
