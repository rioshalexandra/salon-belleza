import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { StoreProvider } from './store';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import PartiesPage from './pages/PartiesPage';
import PartyDetailPage from './pages/PartyDetailPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentEditorPage from './pages/DocumentEditorPage';
import PaymentsPage from './pages/PaymentsPage';
import PricesPage from './pages/PricesPage';
import ImportExportPage from './pages/ImportExportPage';
import MovementsPage from './pages/MovementsPage';
import SettingsPage from './pages/SettingsPage';
import AgendaPage from './pages/AgendaPage';
import CobrarPage from './pages/CobrarPage';
import StaffPage from './pages/StaffPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <StoreProvider>
              <Layout />
            </StoreProvider>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="cobrar" element={<CobrarPage />} />
        <Route path="empleados" element={<AdminOnly><StaffPage /></AdminOnly>} />
        {/* key distinta para que no se mezcle el estado entre servicios y productos */}
        <Route path="servicios" element={<AdminOnly><ProductsPage key="services" kind="services" /></AdminOnly>} />
        <Route path="servicios/:id" element={<AdminOnly><ProductDetailPage /></AdminOnly>} />
        <Route path="productos" element={<AdminOnly><ProductsPage key="products" kind="products" /></AdminOnly>} />
        <Route path="productos/:id" element={<AdminOnly><ProductDetailPage /></AdminOnly>} />
        <Route path="movimientos" element={<AdminOnly><MovementsPage /></AdminOnly>} />
        <Route path="clientes" element={<PartiesPage key="customers" kind="customers" />} />
        <Route path="clientes/:id" element={<PartyDetailPage key="customers" kind="customers" />} />
        <Route path="proveedores" element={<AdminOnly><PartiesPage key="suppliers" kind="suppliers" /></AdminOnly>} />
        <Route path="proveedores/:id" element={<AdminOnly><PartyDetailPage key="suppliers" kind="suppliers" /></AdminOnly>} />
        <Route path="ventas" element={<DocumentsPage kind="sales" />} />
        <Route path="ventas/nueva" element={<DocumentEditorPage kind="sales" />} />
        <Route path="ventas/:id" element={<DocumentEditorPage kind="sales" />} />
        <Route path="compras" element={<AdminOnly><DocumentsPage kind="purchases" /></AdminOnly>} />
        <Route path="compras/nueva" element={<AdminOnly><DocumentEditorPage kind="purchases" /></AdminOnly>} />
        <Route path="compras/:id" element={<AdminOnly><DocumentEditorPage kind="purchases" /></AdminOnly>} />
        <Route path="pagos" element={<AdminOnly><PaymentsPage /></AdminOnly>} />
        <Route path="precios" element={<AdminOnly><PricesPage /></AdminOnly>} />
        <Route path="importar" element={<AdminOnly><ImportExportPage /></AdminOnly>} />
        <Route path="configuracion" element={<AdminOnly><SettingsPage /></AdminOnly>} />
      </Route>
    </Routes>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-full place-items-center text-[#6b6266]">Cargando…</div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// Pantallas de administración: un empleado que entra por link vuelve al inicio
function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
