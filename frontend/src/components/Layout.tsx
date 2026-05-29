import { Outlet, Link, useLocation } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()
  const isActive = (path: string) =>
    location.pathname === path || (path === '/problems' && location.pathname.startsWith('/problem/'))

  const linkStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: active ? '#fff' : 'var(--text-secondary)',
    background: active ? 'var(--bg-hover)' : 'transparent',
    borderRadius: 6,
    textDecoration: 'none',
    transition: 'all 150ms ease',
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Navigation bar */}
      <nav
        className="flex items-center gap-1 px-5 py-2 shrink-0 sticky top-0 z-10"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}
      >
        <Link
          to="/"
          style={{ fontWeight: 700, fontSize: '1rem', color: '#fff', textDecoration: 'none', marginRight: 20 }}
        >
          FalJudge
        </Link>
        <Link to="/" style={linkStyle(isActive('/'))}>主页</Link>
        <Link to="/problems" style={linkStyle(isActive('/problems'))}>题库</Link>
        <Link to="/admin" style={linkStyle(isActive('/admin'))}>管理</Link>
      </nav>

      {/* Page content */}
      <Outlet />
    </div>
  )
}
