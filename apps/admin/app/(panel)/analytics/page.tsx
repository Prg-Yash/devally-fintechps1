import { fetchAdmin } from "@/app/lib/admin-api";

interface StatusCount {
  status: string;
  count: number;
}

interface AnalyticsResponse {
  totals: {
    users: number;
    agreements: number;
    tickets: number;
    purchases: number;
  };
  agreementsByStatus: StatusCount[];
  ticketsByStatus: StatusCount[];
  purchasesByStatus: StatusCount[];
}

export default async function AnalyticsPage() {
  const data = (await fetchAdmin("/admin/analytics")) as AnalyticsResponse;

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>Platform Analytics</h2>
        <p>Global KPIs across users, agreements, disputes, and payments.</p>
      </header>

      <div className="stat-grid">
        <article className="stat-card">
          <h3>Users</h3>
          <strong>{data.totals.users}</strong>
        </article>
        <article className="stat-card">
          <h3>Agreements</h3>
          <strong>{data.totals.agreements}</strong>
        </article>
        <article className="stat-card">
          <h3>Tickets</h3>
          <strong>{data.totals.tickets}</strong>
        </article>
        <article className="stat-card">
          <h3>Purchases</h3>
          <strong>{data.totals.purchases}</strong>
        </article>
      </div>

      <div className="panel-grid">
        <article className="panel-card">
          <h3>Agreement Status</h3>
          <ul>
            {data.agreementsByStatus.map((item) => (
              <li key={item.status}>
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel-card">
          <h3>Ticket Status</h3>
          <ul>
            {data.ticketsByStatus.map((item) => (
              <li key={item.status}>
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel-card">
          <h3>Purchase Status</h3>
          <ul>
            {data.purchasesByStatus.map((item) => (
              <li key={item.status}>
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
