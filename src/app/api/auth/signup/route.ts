import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signupInputSchema } from "@/lib/types";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { apiError, validationError } from "@/lib/api-error";

const EMAIL_TAKEN_MESSAGE = "An account with this email already exists";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = signupInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { email, password } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return apiError(EMAIL_TAKEN_MESSAGE, 409, { code: "email_taken" });
  }

  const passwordHash = await hashPassword(password);
  let user;
  try {
    [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning();
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return apiError(EMAIL_TAKEN_MESSAGE, 409, { code: "email_taken" });
    }
    throw err;
  }

  await setSessionCookie({ id: user.id, email: user.email });

  return NextResponse.json(
    { user: { id: user.id, email: user.email } },
    { status: 201 }
  );
}
