import { NavLink } from 'react-router-dom'
import { useOverview } from '../lib/api'

export function NavBar() {
  const { data } = useOverview()
  return (
    <header className="nav" role="banner">
      <div className="brand-wrap">
        <div className="brand-text">Yolk</div>
      </div>
      <nav aria-label="Primary">
        <NavLink to="/overview" className={({ isActive }) => isActive ? 'link active' : 'link'}>Overview</NavLink>
        <NavLink to="/assistant" className={({ isActive }) => isActive ? 'link active' : 'link'}>Assistant</NavLink>
        <NavLink to="/scanner" className={({ isActive }) => isActive ? 'link active' : 'link'}>QR Scanner</NavLink>
        <NavLink to="/settings" className={({ isActive }) => isActive ? 'link active' : 'link'}>Settings</NavLink>
      </nav>
      <div className="nav-right">
        <div className="merchant">{data?.merchantHandle ?? 'H(merch_—)'}</div>
        <button className="icon-btn" aria-label="Notifications">
          <span role="img" aria-hidden>🔔</span>
        </button>
      </div>
    </header>
  )
}


