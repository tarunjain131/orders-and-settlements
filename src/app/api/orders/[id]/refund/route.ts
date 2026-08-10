import { NextRequest, NextResponse } from "next/server";
import { createRefund } from "@/lib/orders";
import { refundInputSchema } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = refundInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }
  try {
    const order = await createRefund(Number(id), parsed.data);
    return NextResponse.json({ order });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message || "Failed to create refund" },
      { status }
    );
  }
}
