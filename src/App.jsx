import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { StoreProvider, useStore } from './store';
import { planIncludes } from './format';
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
import PedidoPage from './pages/PedidoPage';

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
        <Route path="agenda" element={<PlanOnly feature="agenda"><AgendaPage /></PlanOnly>} />
        <Route path="cobrar" element={<CobrarPage />} />
        <Route path="pedido" element={<PlanOnly feature="stock"><AdminOnly><PedidoPage /></AdminOnly></PlanOnly>} />
        <Route path="empleados" element={<AdminOnly><StaffPage /></AdminOnly>} />
        {/* key distinta para que no se mezcle el estado entre servicios y productos */}
        <Route path="servicios" element={<AdminOnly><ProductsPage key="services" kind="services" /></AdminOnly>} />
        <Route path="servicios/:id" element={<AdminOnly><ProductDetailPage /></AdminOnly>} />
        <Route path="productos" element={<PlanOnly feature="stock"><AdminOnly><ProductsPage key="products" kind="products" /></AdminOnly></PlanOnly>} />
        <Route path="productos/:id" element={<PlanOnly feature="stock"><AdminOnly><ProductDetailPage /></AdminOnly></PlanOnly>} />
        <Route path="movimientos" element={<PlanOnly feature="stock"><AdminOnly><MovementsPage /></AdminOnly></PlanOnly>} />
        <Route path="clientes" element={<PartiesPage key="customers" kind="customers" />} />
        <Route path="clientes/:id" element={<PartyDetailPage key="customers" kind="customers" />} />
        <Route path="proveedores" element={<PlanOnly feature="stock"><AdminOnly><PartiesPage key="suppliers" kind="suppliers" /></AdminOnly></PlanOnly>} />
        <Route path="proveedores/:id" element={<PlanOnly feature="stock"><AdminOnly><PartyDetailPage key="suppliers" kind="suppliers" /></AdminOnly></PlanOnly>} />
        <Route path="ventas" element={<DocumentsPage kind="sales" />} />
        <Route path="ventas/nueva" element={<DocumentEditorPage kind="sales" />} />
        <Route path="ventas/:id" element={<DocumentEditorPage kind="sales" />} />
        <Route path="compras" element={<PlanOnly feature="stock"><AdminOnly><DocumentsPage kind="purchases" /></AdminOnly></PlanOnly>} />
        <Route path="compras/nueva" element={<PlanOnly feature="stock"><AdminOnly><DocumentEditorPage kind="purchases" /></AdminOnly></PlanOnly>} />
        <Route path="compras/:id" element={<PlanOnly feature="stock"><AdminOnly><DocumentEditorPage kind="purchases" /></AdminOnly></PlanOnly>} />
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

// Secciones que dependen del plan: si el plan del negocio no las incluye, se vuelve al inicio
function PlanOnly({ feature, children }) {
  const { settings } = useStore();
  if (settings && !planIncludes(settings.plan, feature)) return <Navigate to="/" replace />;
  return children;
}
