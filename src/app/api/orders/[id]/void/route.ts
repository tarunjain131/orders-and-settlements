import { NextRequest, NextResponse } from "next/server";
import { voidOrder } from "@/lib/orders";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const order = await voidOrder(Number(id));
    return NextResponse.json({ order });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message || "Failed to void order" },
      { status }
    );
  }
}
