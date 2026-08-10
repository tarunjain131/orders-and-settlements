import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getOrder } from "@/lib/orders";
import PaymentForm from "@/components/PaymentForm";
import { formatMoney } from "@/lib/format";

export default async function RecordPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(Number(id));
  if (!order) notFound();

  const balanceDue = Math.max(
    Number(order.totalAmount) - Number(order.amountPaid),
    0
  );

  return (
    <div className="flex-1 flex flex-col">
      <header className="h-16 border-b border-gray-200 bg-white flex items-center px-6 gap-3">
        <Link
          href={`/orders/${order.id}`}
          className="text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold">
          Record payment — {order.name}
        </h1>
      </header>
      <div className="p-6 max-w-md">
        <p className="text-sm text-gray-600 mb-4">
          Balance due: <strong>{formatMoney(balanceDue, order.currency)}</strong>
        </p>
        <PaymentForm orderId={order.id} maxAmount={balanceDue} />
      </div>
    </div>
  );
}
