import { fetchAdmin, formatDate } from "@/app/lib/admin-api";

interface TicketRow {
  id: string;
  title: string;
  reason: string;
  status: string;
  createdAt: string;
  raisedBy: { email: string };
  againstUser: { email: string };
  agreement?: { id: string; title: string } | null;
}

interface TicketsResponse {
  count: number;
  tickets: TicketRow[];
}

export default async function TicketsPage() {
  const data = (await fetchAdmin("/admin/tickets?limit=200")) as TicketsResponse;

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>Dispute Tickets</h2>
        <p>Monitor all disputes and review ticket context quickly.</p>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Raised By</th>
              <th>Against</th>
              <th>Agreement</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>{ticket.title}</td>
                <td>{ticket.status}</td>
                <td>{ticket.reason}</td>
                <td>{ticket.raisedBy.email}</td>
                <td>{ticket.againstUser.email}</td>
                <td>{ticket.agreement ? ticket.agreement.title : "-"}</td>
                <td>{formatDate(ticket.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
