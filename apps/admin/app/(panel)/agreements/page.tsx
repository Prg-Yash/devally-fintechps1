import { fetchAdmin, formatAmount, formatDate } from "@/app/lib/admin-api";

interface AgreementRow {
  id: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  creator: { name: string; email: string };
  receiver: { name: string; email: string };
  milestones: Array<{ id: string }>;
  _count: { tickets: number };
}

interface AgreementsResponse {
  count: number;
  agreements: AgreementRow[];
}

export default async function AgreementsPage() {
  const data = (await fetchAdmin("/admin/agreements?limit=200")) as AgreementsResponse;

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>Agreement Oversight</h2>
        <p>Track all escrow agreements, participants, and dispute linkage.</p>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Creator</th>
              <th>Receiver</th>
              <th>Milestones</th>
              <th>Tickets</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.agreements.map((agreement) => (
              <tr key={agreement.id}>
                <td>{agreement.title}</td>
                <td>{agreement.status}</td>
                <td>
                  {formatAmount(agreement.amount)} {agreement.currency}
                </td>
                <td>{agreement.creator.email}</td>
                <td>{agreement.receiver.email}</td>
                <td>{agreement.milestones.length}</td>
                <td>{agreement._count.tickets}</td>
                <td>{formatDate(agreement.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
