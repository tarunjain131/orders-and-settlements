"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";

type LineItem = {
  id: number;
  title: string;
  sku: string | null;
  price: number;
  quantity: number;
  remainingQuantity: number;
};

export default function RefundForm({
  orderId,
  currency,
  maxAmount,
  lineItems,
}: {
  orderId: number;
  currency: string;
  maxAmount: number;
  lineItems: LineItem[];
}) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [extraAmount, setExtraAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsRefundTotal = useMemo(
    () =>
      lineItems.reduce(
        (sum, li) => sum + (quantities[li.id] ?? 0) * li.price,
        0
      ),
    [quantities, lineItems]
  );
  const totalRefund = Math.min(itemsRefundTotal + (extraAmount || 0), maxAmount);

  function setQty(id: number, qty: number, max: number) {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, Math.min(qty, max)) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (totalRefund <= 0) {
      setError("Enter a quantity to refund or a refund amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalRefund,
          reason: reason || null,
          note: note || null,
          lineItems: Object.entries(quantities)
            .filter(([, qty]) => qty > 0)
            .map(([lineItemId, quantity]) => ({
              lineItemId: Number(lineItemId),
              quantity,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create refund");
      router.push(`/orders/${orderId}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Item</th>
              <th className="text-right font-medium px-4 py-2.5">Price</th>
              <th className="text-right font-medium px-4 py-2.5">
                Qty to refund
              </th>
              <th className="text-right font-medium px-4 py-2.5">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineItems.map((li) => (
              <tr key={li.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{li.title}</div>
                  <div className="text-xs text-gray-500">
                    {li.remainingQuantity} of {li.quantity} refundable
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {formatMoney(li.price, currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    min={0}
                    max={li.remainingQuantity}
                    value={quantities[li.id] ?? 0}
                    disabled={li.remainingQuantity === 0}
                    onChange={(e) =>
                      setQty(li.id, Number(e.target.value), li.remainingQuantity)
                    }
                    className="input w-20 text-right inline-block"
                  />
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney((quantities[li.id] ?? 0) * li.price, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">
            Additional refund amount (e.g. shipping)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={extraAmount}
            onChange={(e) => setExtraAmount(Number(e.target.value))}
            className="input w-48"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">
            Reason
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer changed their mind"
            className="input"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">
            Note (optional)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
            rows={2}
          />
        </label>

        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-600">
            Max refundable: {formatMoney(maxAmount, currency)}
          </span>
          <span className="font-semibold">
            Total refund: {formatMoney(totalRefund, currency)}
          </span>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || totalRefund <= 0}
          className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? "Refunding..." : `Refund ${formatMoney(totalRefund, currency)}`}
        </button>
      </div>

      <style jsx global>{`
        .input {
          border: 1px solid rgb(209 213 219);
          border-radius: 6px;
          padding: 0.5rem 0.65rem;
          font-size: 0.875rem;
          width: 100%;
        }
        .input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgb(16 185 129 / 0.5);
          border-color: rgb(16 185 129);
        }
      `}</style>
    </form>
  );
}
