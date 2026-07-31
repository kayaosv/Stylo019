import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/productos', label: 'Productos', end: true },
  { to: '/admin/productos/nuevo', label: 'Nuevo producto', end: false },
  { to: '/admin/venta-fisica', label: 'Venta física', end: true },
  { to: '/admin/pedidos', label: 'Pedidos', end: false },
  { to: '/admin/hero', label: 'Hero', end: true },
  { to: '/admin/categorias', label: 'Categorías', end: true },
  { to: '/admin/envios', label: 'Envíos', end: true },
]

const SIDEBAR_COLLAPSED_KEY = 'stylo019-admin-sidebar-collapsed'
const SIDEBAR_WIDTH = '18rem'

export const AdminLayout = () => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // Sidebar de escritorio colapsable — antes era `hidden md:flex` fijo,
  // sin forma de cerrarlo en pantallas >=768px, robándole espacio
  // permanente al contenido del dashboard. Colapsado por defecto
  // (preferencia del dueño), se recuerda entre visitas.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(SIDEBAR_COLLAPSED_KEY) : null
    return stored === null ? true : stored === 'true'
  })

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Close drawer on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Bloquear el scroll de fondo mientras el drawer móvil está abierto —
  // sin esto, en páginas largas (como el nuevo Dashboard) el contenido
  // de atrás se sigue desplazando por debajo del overlay fijo, dando la
  // sensación de un menú "pegado" que no se cierra ni se puede recorrer.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div
      className="flex min-h-screen bg-[var(--color-base)] text-[var(--color-ink)]"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {/* Toggle del sidebar de escritorio — vive fuera del <aside> para
          seguir siendo alcanzable incluso cuando este colapsa a ancho 0. */}
      <button
        type="button"
        onClick={() => setSidebarCollapsed((v) => !v)}
        aria-label={sidebarCollapsed ? 'Abrir menú' : 'Colapsar menú'}
        className="hidden items-center justify-center bg-[var(--color-paper)] text-[var(--color-muted)] md:flex"
        style={{
          position: 'fixed',
          top: '1.5rem',
          left: sidebarCollapsed ? '0.75rem' : `calc(${SIDEBAR_WIDTH} - 0.75rem)`,
          zIndex: 50,
          width: '2rem',
          height: '2rem',
          border: '1px solid var(--color-surface)',
          fontSize: '1rem',
          transition: 'left 280ms ease',
        }}
      >
        {sidebarCollapsed ? '›' : '‹'}
      </button>

      {/* Sidebar — desktop only, colapsable */}
      <aside
        className="sticky top-0 hidden h-screen flex-col border-r border-[var(--color-surface)] bg-[var(--color-paper)] md:flex"
        style={{
          width: sidebarCollapsed ? '0rem' : SIDEBAR_WIDTH,
          padding: sidebarCollapsed ? '2.5rem 0' : '2.5rem 1.75rem',
          overflow: 'hidden',
          transition: 'width 280ms ease, padding 280ms ease',
        }}
      >
        <div className="mb-14">
          <span
            className="label-xs text-[var(--color-accent)] block"
            style={{ letterSpacing: '0.3em' }}
          >
            Stylo019
          </span>
          <h2
            className="font-serif text-[var(--color-ink)]"
            style={{
              fontSize: '1.75rem',
              fontWeight: 300,
              letterSpacing: '-0.01em',
              marginTop: '0.4rem',
              lineHeight: 1,
            }}
          >
            Panel admin
          </h2>
        </div>

        <nav className="flex flex-col" style={{ gap: '0.25rem' }}>
          <span
            className="label-xs text-[var(--color-muted)]"
            style={{ marginBottom: '0.75rem', letterSpacing: '0.25em' }}
          >
            Gestión
          </span>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `font-sans transition-colors ${
                  isActive
                    ? 'text-[var(--color-ink)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`
              }
              style={({ isActive }) => ({
                fontSize: '0.88rem',
                padding: '0.7rem 0',
                borderLeft: isActive
                  ? '2px solid var(--color-accent)'
                  : '2px solid transparent',
                paddingLeft: '0.85rem',
                letterSpacing: '0.02em',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col" style={{ gap: '0.75rem' }}>
          <div
            className="border-t border-[var(--color-surface)]"
            style={{ paddingTop: '1.25rem' }}
          >
            <span
              className="label-xs text-[var(--color-muted)] block"
              style={{ letterSpacing: '0.2em', marginBottom: '0.35rem' }}
            >
              Sesión
            </span>
            <span
              className="font-sans text-[var(--color-ink)]"
              style={{
                fontSize: '0.8rem',
                wordBreak: 'break-all',
                display: 'block',
              }}
            >
              {user?.email ?? '—'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full bg-[var(--color-ink)] text-[var(--color-paper)] transition-opacity hover:opacity-85"
            style={{
              padding: '0.85rem 1rem',
              fontSize: '0.72rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <header
        className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-[var(--color-surface)] bg-[var(--color-paper)] md:hidden"
        style={{ padding: '1rem 1.25rem' }}
      >
        <span
          className="font-serif"
          style={{ fontSize: '1.1rem', fontWeight: 400, letterSpacing: '-0.01em' }}
        >
          Admin
        </span>

        {/* Hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          className="flex flex-col items-center justify-center"
          style={{ width: '2rem', height: '2rem', gap: '5px' }}
        >
          <span
            className="block bg-[var(--color-ink)] transition-all duration-300"
            style={{
              width: '1.35rem',
              height: '1.5px',
              transform: menuOpen ? 'translateY(6.5px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block bg-[var(--color-ink)] transition-all duration-300"
            style={{
              width: '1.35rem',
              height: '1.5px',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block bg-[var(--color-ink)] transition-all duration-300"
            style={{
              width: '1.35rem',
              height: '1.5px',
              transform: menuOpen ? 'translateY(-6.5px) rotate(-45deg)' : 'none',
            }}
          />
        </button>
      </header>

      {/* Mobile drawer backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: 'rgba(10, 10, 10, 0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className="fixed top-0 left-0 z-40 flex h-full flex-col bg-[var(--color-paper)] border-r border-[var(--color-surface)] md:hidden transition-transform duration-300"
        style={{
          width: '17rem',
          padding: '2rem 1.5rem',
          overflowY: 'auto',
          transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div className="mb-10 mt-12">
          <span
            className="label-xs text-[var(--color-accent)] block"
            style={{ letterSpacing: '0.3em' }}
          >
            Stylo019
          </span>
          <h2
            className="font-serif text-[var(--color-ink)]"
            style={{ fontSize: '1.5rem', fontWeight: 300, letterSpacing: '-0.01em', marginTop: '0.35rem', lineHeight: 1 }}
          >
            Panel admin
          </h2>
        </div>

        <nav className="flex flex-col" style={{ gap: '0.25rem' }}>
          <span
            className="label-xs text-[var(--color-muted)]"
            style={{ marginBottom: '0.75rem', letterSpacing: '0.25em' }}
          >
            Gestión
          </span>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `font-sans transition-colors ${
                  isActive
                    ? 'text-[var(--color-ink)]'
                    : 'text-[var(--color-muted)]'
                }`
              }
              style={({ isActive }) => ({
                fontSize: '1rem',
                padding: '0.85rem 0',
                borderLeft: isActive
                  ? '2px solid var(--color-accent)'
                  : '2px solid transparent',
                paddingLeft: '0.85rem',
                letterSpacing: '0.02em',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col" style={{ gap: '0.75rem' }}>
          <div
            className="border-t border-[var(--color-surface)]"
            style={{ paddingTop: '1.25rem' }}
          >
            <span
              className="label-xs text-[var(--color-muted)] block"
              style={{ letterSpacing: '0.2em', marginBottom: '0.35rem' }}
            >
              Sesión
            </span>
            <span
              className="font-sans text-[var(--color-ink)]"
              style={{ fontSize: '0.78rem', wordBreak: 'break-all', display: 'block' }}
            >
              {user?.email ?? '—'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full bg-[var(--color-ink)] text-[var(--color-paper)] transition-opacity hover:opacity-85"
            style={{
              padding: '0.85rem 1rem',
              fontSize: '0.72rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main */}
      <main
        className="flex-1"
        style={{
          padding: 'clamp(1.5rem, 4vw, 3.5rem)',
          paddingTop: 'clamp(4.5rem, 6vw, 3.5rem)',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}
