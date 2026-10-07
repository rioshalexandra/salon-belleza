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
        {/* key distinta para que no se mezcle el estado entre servicios y productos */}
        <Route path="servicios" element={<ProductsPage key="services" kind="services" />} />
        <Route path="servicios/:id" element={<ProductDetailPage />} />
        <Route path="productos" element={<ProductsPage key="products" kind="products" />} />
        <Route path="productos/:id" element={<ProductDetailPage />} />
        <Route path="movimientos" element={<MovementsPage />} />
        <Route path="clientes" element={<PartiesPage key="customers" kind="customers" />} />
        <Route path="clientes/:id" element={<PartyDetailPage key="customers" kind="customers" />} />
        <Route path="proveedores" element={<PartiesPage key="suppliers" kind="suppliers" />} />
        <Route path="proveedores/:id" element={<PartyDetailPage key="suppliers" kind="suppliers" />} />
        <Route path="ventas" element={<DocumentsPage kind="sales" />} />
        <Route path="ventas/nueva" element={<DocumentEditorPage kind="sales" />} />
        <Route path="ventas/:id" element={<DocumentEditorPage kind="sales" />} />
        <Route path="compras" element={<DocumentsPage kind="purchases" />} />
        <Route path="compras/nueva" element={<DocumentEditorPage kind="purchases" />} />
        <Route path="compras/:id" element={<DocumentEditorPage kind="purchases" />} />
        <Route path="pagos" element={<PaymentsPage />} />
        <Route path="precios" element={<PricesPage />} />
        <Route path="importar" element={<ImportExportPage />} />
        <Route path="configuracion" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-full place-items-center text-[#7a6f73]">Cargando…</div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
