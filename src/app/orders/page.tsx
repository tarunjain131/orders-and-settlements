import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { listOrders } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, formatMoney } from "@/lib/format";

const STATUS_TABS = [
  { value: "any", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "refunded", label: "Refunded" },
  { value: "voided", label: "Voided" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const q = params.q ?? "";
  const status = params.status ?? "any";
  const orders = await listOrders(user.id, { q, status });

  return (
    <div className="flex-1 flex flex-col">
      <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6">
        <h1 className="text-lg font-semibold">Orders</h1>
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus size={16} />
          Create order
        </Link>
      </header>

      <div className="p-6 flex-1">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-4 pt-3">
            <div className="flex gap-1 overflow-x-auto -mb-px">
              {STATUS_TABS.map((tab) => (
                <Link
                  key={tab.value}
                  href={`/orders?${new URLSearchParams({
                    ...(q ? { q } : {}),
                    status: tab.value,
                  }).toString()}`}
                  className={`whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 ${
                    status === tab.value
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="p-4 border-b border-gray-200">
            <form action="/orders" className="relative max-w-sm">
              <input type="hidden" name="status" value={status} />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search orders, customers..."
                className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </form>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No orders found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Order</th>
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Customer</th>
                  <th className="text-left font-medium px-4 py-3">Payment status</th>
                  <th className="text-right font-medium px-4 py-3">Items</th>
                  <th className="text-right font-medium px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        {order.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {order.customerName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.displayStatus} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {order.itemCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(order.totalAmount, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
