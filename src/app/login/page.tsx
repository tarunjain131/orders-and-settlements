import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold mb-1">Log in</h1>
        <p className="text-sm text-gray-500 mb-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-emerald-700 hover:underline">
            Sign up
          </Link>
        </p>
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
