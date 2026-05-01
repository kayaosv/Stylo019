import { lazy, Suspense } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/admin/ProtectedRoute'

// Lazy-load pages to keep initial bundle small — each route is its own chunk.
const Home = lazy(() => import('@/pages/Home'))
const Catalogo = lazy(() => import('@/pages/Catalogo'))
const Producto = lazy(() => import('@/pages/Producto'))
const Contacto = lazy(() => import('@/pages/Contacto'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const CheckoutSuccess = lazy(() => import('@/pages/CheckoutSuccess'))
const CheckoutCancel = lazy(() => import('@/pages/CheckoutCancel'))
const Privacidad = lazy(() => import('@/pages/Privacidad'))
const Cookies = lazy(() => import('@/pages/Cookies'))
const Terminos = lazy(() => import('@/pages/Terminos'))

// Admin bundle kept together — rarely visited, still off the critical path.
const Login = lazy(() => import('@/pages/admin/Login'))
const AdminLayout = lazy(() =>
  import('@/components/admin/AdminLayout').then((m) => ({ default: m.AdminLayout }))
)
const ProductosList = lazy(() => import('@/pages/admin/ProductosList'))
const ProductoForm = lazy(() => import('@/pages/admin/ProductoForm'))
const HeroSettings = lazy(() => import('@/pages/admin/HeroSettings'))
const Categorias = lazy(() => import('@/pages/admin/Categorias'))
const Envios = lazy(() => import('@/pages/admin/Envios'))

gsap.registerPlugin(useGSAP)

const PreloaderDismiss = () => {
  useGSAP(() => {
    const el = document.getElementById('preloader')
    if (!el) return
    gsap.to(el, {
      opacity: 0,
      duration: 0.65,
      ease: 'power2.inOut',
      delay: 0.4,
      onComplete: () => el.remove(),
    })
  })
  return null
}

const RouteFallback = () => (
  <div
    className="flex items-center justify-center"
    style={{ minHeight: '100vh', background: 'var(--color-base)' }}
  >
    <span
      className="label-xs"
      style={{ color: 'var(--color-muted)', letterSpacing: '0.25em' }}
    >
      Cargando…
    </span>
  </div>
)

const App = () => (
  <BrowserRouter>
    <PreloaderDismiss />
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/producto/:id" element={<Producto />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/checkout/cancel" element={<CheckoutCancel />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/terminos" element={<Terminos />} />
        </Route>

        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProductosList />} />
          <Route path="productos/nuevo" element={<ProductoForm />} />
          <Route path="productos/:id" element={<ProductoForm />} />
          <Route path="hero" element={<HeroSettings />} />
          <Route path="categorias" element={<Categorias />} />
          <Route path="envios" element={<Envios />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
)

export default App
