"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VoidButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVoid() {
    if (!confirm("Void this order? This can't be undone.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/void`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to void order");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleVoid}
        disabled={loading}
        className="w-full px-3 py-2 text-sm font-medium rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {loading ? "Voiding..." : "Void order"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
