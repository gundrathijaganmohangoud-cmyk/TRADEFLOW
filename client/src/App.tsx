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
  roles: Role[] | null; // null = visible to every signed-in role
}

const NAV_ITEMS: NavItem[] = [
  { to: "/customers", label: "Customers", roles: ["ADMIN", "SALES"] },
  { to: "/challans", label: "Challans", roles: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"] },
  { to: "/products", label: "Products", roles: ["ADMIN", "WAREHOUSE"] },
  { to: "/stock", label: "Stock Movements", roles: ["ADMIN", "WAREHOUSE"] },
  { to: "/users", label: "Users", roles: ["ADMIN"] },
];

function Sidebar() {
  const { user } = useAuth();
  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles === null || item.roles.includes(user.role));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>TradeFlow</h1>
        <span>ERP / CRM Portal</span>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {item.label}
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
      <div className="topbar-user">
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
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Welcome to TradeFlow</h2>
          <p>Pick a section from the sidebar to get started.</p>
        </div>
      </div>
      <div className="card">
        <h3>Quick overview</h3>
        <p className="text-muted">
          Customers, challans, inventory and user administration live in the sidebar. Write access
          is enforced by the API per role — the portal hides what you cannot use.
        </p>
      </div>
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
