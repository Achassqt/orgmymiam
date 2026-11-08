import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MealPlansPage } from './pages/MealPlansPage';
import { ProductsPage } from './pages/ProductsPage';
import { RecipesPage } from './pages/RecipesPage';
import { RegisterPage } from './pages/RegisterPage';
import { ShoppingListPage } from './pages/ShoppingListPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="produits" element={<ProductsPage />} />
              <Route path="recettes" element={<RecipesPage />} />
              <Route path="plans" element={<MealPlansPage />} />
              <Route path="liste" element={<ShoppingListPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
