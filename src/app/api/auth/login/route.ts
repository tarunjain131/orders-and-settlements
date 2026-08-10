import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { loginInputSchema } from "@/lib/types";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = loginInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS_MESSAGE },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: INVALID_CREDENTIALS_MESSAGE },
      { status: 401 }
    );
  }

  await setSessionCookie({ id: user.id, email: user.email });

  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
