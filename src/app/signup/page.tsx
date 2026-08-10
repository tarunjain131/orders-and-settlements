import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold mb-1">Sign up</h1>
        <p className="text-sm text-gray-500 mb-6">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-700 hover:underline">
            Log in
          </Link>
        </p>
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
