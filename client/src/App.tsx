import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, RequireRoles, useAuth } from "./auth";
import type { Role } from "./api";
import ChallanDetail from "./pages/ChallanDetail";
import Challans from "./pages/Challans";
import CustomerDetail from "./pages/CustomerDetail";
import Customers from "./pages/Customers";
import Login from "./pages/Login";
import Products from "./pages/Products";
import StockMovements from "./pages/StockMovements";
import Users from "./pages/Users";

// ---------------------------------------------------------------------------
// Sidebar navigation, filtered by the signed-in user's role
// ---------------------------------------------------------------------------

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: Role[] | null; // null = visible to every signed-in role
}

const NAV_ITEMS: NavItem[] = [
  { to: "/customers", label: "Customers", icon: "01", roles: ["ADMIN", "SALES"] },
  { to: "/challans", label: "Challans", icon: "02", roles: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"] },
  { to: "/products", label: "Products", icon: "03", roles: ["ADMIN", "WAREHOUSE"] },
  { to: "/stock", label: "Stock movements", icon: "04", roles: ["ADMIN", "WAREHOUSE"] },
  { to: "/users", label: "Team access", icon: "05", roles: ["ADMIN"] },
];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Command center",
  SALES: "Sales workspace",
  WAREHOUSE: "Warehouse workspace",
  ACCOUNTS: "Accounts workspace",
};

function Sidebar() {
  const { user } = useAuth();
  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles === null || item.roles.includes(user.role));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">T</div>
        <div>
          <h1>TradeFlow</h1>
          <span>Operations OS</span>
        </div>
      </div>
      <div className="workspace-label">{ROLE_LABELS[user.role]}</div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">Signed in as {user.email}</div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Topbar with user name, role badge and logout
// ---------------------------------------------------------------------------

function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="topbar">
      <div className="topbar-context">
        <span className="live-dot" /> Live workspace
      </div>
      <div className="topbar-user">
        <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
        <span className="topbar-name">{user.name}</span>
        <span className="role-badge">{user.role}</span>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
        Logout
      </button>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Default landing page
// ---------------------------------------------------------------------------

function Home() {
  const { user } = useAuth();

  const roleContent: Record<Role, { eyebrow: string; title: string; body: string; links: Array<{ label: string; to: string; note: string }> }> = {
    ADMIN: {
      eyebrow: "Your command center",
      title: "See the whole operation at a glance.",
      body: "Keep customers, inventory, dispatch and team access moving from one calm workspace.",
      links: [
        { label: "Review team access", to: "/users", note: "Admin controls" },
        { label: "Open inventory", to: "/products", note: "Stock health" },
        { label: "View dispatch", to: "/challans", note: "Order flow" },
      ],
    },
    SALES: {
      eyebrow: "Your sales desk",
      title: "Turn every customer conversation into momentum.",
      body: "Move from relationship to confirmed dispatch without losing the context that matters.",
      links: [
        { label: "Find a customer", to: "/customers", note: "Relationships" },
        { label: "Create a challan", to: "/challans", note: "Dispatch faster" },
      ],
    },
    WAREHOUSE: {
      eyebrow: "Your warehouse view",
      title: "Know what is moving before it becomes urgent.",
      body: "A focused view of catalogue, stock levels and every inventory adjustment in your operation.",
      links: [
        { label: "Check products", to: "/products", note: "Catalogue" },
        { label: "Audit movements", to: "/stock", note: "Inventory trail" },
        { label: "Review challans", to: "/challans", note: "Fulfilment" },
      ],
    },
    ACCOUNTS: {
      eyebrow: "Your accounts view",
      title: "Keep every handoff clear and accountable.",
      body: "Follow the dispatch record from customer to confirmed challan with the details close at hand.",
      links: [{ label: "Review challans", to: "/challans", note: "Dispatch ledger" }],
    },
  };

  const content = roleContent[user?.role ?? "ADMIN"];

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="eyebrow">{content.eyebrow}</span>
          <h2>{content.title}</h2>
          <p>{content.body}</p>
          <div className="hero-meta"><span className="live-dot" /> Everything is in sync</div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="visual-core"><span>TF</span><small>FLOW</small></div>
          <div className="float-card float-card-one"><strong>100%</strong><span>Visibility</span></div>
          <div className="float-card float-card-two"><strong>24/7</strong><span>Control room</span></div>
        </div>
      </section>

      <div className="section-heading"><div><span className="eyebrow">Jump back in</span><h3>Workspaces for your day</h3></div><span className="text-muted">{content.links.length} recommended actions</span></div>
      <section className="action-grid">
        {content.links.map((link, index) => (
          <NavLink className="action-card" to={link.to} key={link.to}>
            <span className="action-number">0{index + 1}</span>
            <span className="action-label">{link.label}</span>
            <span className="action-note">{link.note}<b>→</b></span>
          </NavLink>
        ))}
      </section>

      <section className="signal-strip">
        <div><span className="signal-icon">◎</span><div><strong>One source of truth</strong><span>Every action is permission-aware and traceable.</span></div></div>
        <div><span className="signal-icon">↗</span><div><strong>Built for handoffs</strong><span>Sales, warehouse and accounts stay aligned.</span></div></div>
        <div><span className="signal-icon">✓</span><div><strong>Ready when you are</strong><span>Your workspace is connected to the live API.</span></div></div>
      </section>
    </div>
  );
}

function About() {
  return (
    <div className="about-page">
      <div className="public-nav"><NavLink to="/login" className="brand-lockup"><span className="brand-mark">T</span><strong>TradeFlow</strong></NavLink><NavLink to="/login" className="btn btn-primary">Enter workspace →</NavLink></div>
      <section className="about-hero"><span className="eyebrow">The operating layer for trade</span><h1>Make the movement of business feel simple.</h1><p>TradeFlow brings customer relationships, inventory, dispatch and accountability into one connected workspace for teams that keep commerce moving.</p><NavLink to="/login" className="btn btn-primary">Sign in to TradeFlow →</NavLink></section>
      <section className="about-grid"><div><span className="eyebrow">01 / Clarity</span><h2>Every team sees the next useful thing.</h2></div><p>Different roles deserve different focus. TradeFlow gives sales the relationship, warehouse the stock signal, accounts the dispatch record and admins the full picture.</p><div><span className="eyebrow">02 / Control</span><h2>Every important movement leaves a trail.</h2></div><p>From customer creation to inventory adjustment, your operational record stays close, searchable and permission-aware.</p></section>
      <footer className="about-footer"><span>TradeFlow / Operations OS</span><span>Connected commerce, thoughtfully managed.</span></footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<About />} />
        <Route
          path="*"
          element={
            <RequireRoles>
              <div className="app-layout">
                <Sidebar />
                <div className="main-area">
                  <Topbar />
                  <main className="content">
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route
                        path="/customers"
                        element={
                          <RequireRoles roles={["ADMIN", "SALES"]}>
                            <Customers />
                          </RequireRoles>
                        }
                      />
                      <Route
                        path="/customers/:id"
                        element={
                          <RequireRoles roles={["ADMIN", "SALES"]}>
                            <CustomerDetail />
                          </RequireRoles>
                        }
                      />
                      <Route
                        path="/challans"
                        element={
                          <RequireRoles roles={["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"]}>
                            <Challans />
                          </RequireRoles>
                        }
                      />
                      <Route
                        path="/challans/:id"
                        element={
                          <RequireRoles roles={["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"]}>
                            <ChallanDetail />
                          </RequireRoles>
                        }
                      />
                      <Route
                        path="/products"
                        element={
                          <RequireRoles roles={["ADMIN", "WAREHOUSE"]}>
                            <Products />
                          </RequireRoles>
                        }
                      />
                      <Route
                        path="/stock"
                        element={
                          <RequireRoles roles={["ADMIN", "WAREHOUSE"]}>
                            <StockMovements />
                          </RequireRoles>
                        }
                      />
                      <Route
                        path="/users"
                        element={
                          <RequireRoles roles={["ADMIN"]}>
                            <Users />
                          </RequireRoles>
                        }
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </RequireRoles>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
