import { fetchAdmin, formatAmount, formatDate } from "@/app/lib/admin-api";

interface PurchaseRow {
  id: string;
  amount: number;
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  createdAt: string;
  user: { email: string };
}

interface PurchasesResponse {
  count: number;
  purchases: PurchaseRow[];
}

export default async function PurchasesPage() {
  const data = (await fetchAdmin("/admin/purchases?limit=200")) as PurchasesResponse;

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>Payments</h2>
        <p>Inspect all Razorpay purchase records and payment states.</p>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Order ID</th>
              <th>Payment ID</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.purchases.map((purchase) => (
              <tr key={purchase.id}>
                <td>{purchase.user.email}</td>
                <td>{formatAmount(purchase.amount)}</td>
                <td>{purchase.status}</td>
                <td>{purchase.razorpayOrderId}</td>
                <td>{purchase.razorpayPaymentId ?? "-"}</td>
                <td>{formatDate(purchase.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
