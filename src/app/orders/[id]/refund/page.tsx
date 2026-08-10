import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getOrder } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth";
import RefundForm from "@/components/RefundForm";
import { formatMoney } from "@/lib/format";

export default async function RefundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const order = await getOrder(Number(id), user.id);
  if (!order) notFound();

  const refundable = Math.max(
    Number(order.amountPaid) - Number(order.amountRefunded),
    0
  );

  // How much of each line item has already been refunded, so we can cap
  // further refunds at the remaining quantity.
  const refundedQtyByLineItem = new Map<number, number>();
  for (const refund of order.refunds) {
    for (const rli of refund.refundLineItems) {
      refundedQtyByLineItem.set(
        rli.lineItemId,
        (refundedQtyByLineItem.get(rli.lineItemId) ?? 0) + rli.quantity
      );
    }
  }

  const lineItems = order.lineItems.map((li) => ({
    id: li.id,
    description: li.description,
    sku: li.sku,
    price: Number(li.price),
    quantity: li.quantity,
    remainingQuantity: Math.max(
      li.quantity - (refundedQtyByLineItem.get(li.id) ?? 0),
      0
    ),
  }));

  return (
    <div className="flex-1 flex flex-col">
      <header className="h-16 border-b border-gray-200 bg-white flex items-center px-6 gap-3">
        <Link
          href={`/orders/${order.id}`}
          className="text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold">Refund — {order.name}</h1>
      </header>
      <div className="p-6 max-w-2xl">
        <p className="text-sm text-gray-600 mb-4">
          Refundable amount:{" "}
          <strong>{formatMoney(refundable, order.currency)}</strong>
        </p>
        <RefundForm
          orderId={order.id}
          currency={order.currency}
          maxAmount={refundable}
          lineItems={lineItems}
        />
      </div>
    </div>
  );
}
