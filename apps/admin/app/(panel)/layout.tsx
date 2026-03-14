import Link from "next/link";

const navItems = [
  { href: "/analytics", label: "Analytics" },
  { href: "/users", label: "Users" },
  { href: "/agreements", label: "Agreements" },
  { href: "/tickets", label: "Tickets" },
  { href: "/purchases", label: "Purchases" },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell grid min-h-screen md:grid-cols-[260px_1fr]">
      <aside className="admin-sidebar border-b border-white/20 p-5 md:border-b-0 md:border-r">
        <h1 className="admin-logo mb-4 text-xl font-semibold tracking-tight">Nexus Admin</h1>
        <nav className="admin-nav flex flex-wrap gap-2 md:flex-col">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="admin-nav-link rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="admin-main p-6">{children}</main>
    </div>
  );
}
