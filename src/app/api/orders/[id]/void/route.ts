import { NextRequest, NextResponse } from "next/server";
import { voidOrder } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const order = await voidOrder(Number(id), user.id);
    return NextResponse.json({ order });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message || "Failed to void order" },
      { status }
    );
  }
}
