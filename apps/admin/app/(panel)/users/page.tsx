import { fetchAdmin, formatDate } from "@/app/lib/admin-api";

interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean | null;
  createdAt: string;
  _count: {
    purchases: number;
    createdAgreements: number;
    receivedAgreements: number;
    raisedTickets: number;
    ticketsAgainstMe: number;
  };
}

interface UsersResponse {
  count: number;
  users: UserRow[];
}

export default async function UsersPage() {
  const data = (await fetchAdmin("/admin/users?limit=200")) as UsersResponse;

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h2>User Management</h2>
        <p>View all registered users and engagement metrics.</p>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Verified</th>
              <th>2FA</th>
              <th>Purchases</th>
              <th>Agreements</th>
              <th>Tickets</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.emailVerified ? "Yes" : "No"}</td>
                <td>{user.twoFactorEnabled ? "On" : "Off"}</td>
                <td>{user._count.purchases}</td>
                <td>{user._count.createdAgreements + user._count.receivedAgreements}</td>
                <td>{user._count.raisedTickets + user._count.ticketsAgainstMe}</td>
                <td>{formatDate(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
