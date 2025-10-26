import { Routes, Route, Navigate } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { QRCodes } from './pages/QRCodes'
import { QRScanner } from './pages/QRScanner'
import { History } from './pages/History'
import { Overview } from './pages/Overview'
import { Payments } from './pages/Payments'
import { ProofTags } from './pages/ProofTags'
import { SupplyChain } from './pages/SupplyChain'
import { Receipts } from './pages/Receipts'
import { Settings } from './pages/Settings'
import { DeliveryFeed } from './pages/DeliveryFeed'
import { DeliveryRoute } from './pages/DeliveryRoute'
import { NewRoute } from './pages/NewRoute'
import { RegisterBatch } from './pages/RegisterBatch'
import { GenerateProofTag } from './pages/GenerateProofTag'
import { RouteDetails } from './pages/RouteDetails'
import { Assistant } from './pages/Assistant'

export default function App() {
  return (
    <div className="app">
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/prooftags" element={<ProofTags />} />
          <Route path="/supply" element={<SupplyChain />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/deliveries" element={<DeliveryFeed />} />
          <Route path="/delivery/:id" element={<DeliveryRoute />} />
          <Route path="/qr" element={<QRCodes />} />
          <Route path="/scanner" element={<QRScanner />} />
          <Route path="/history" element={<History />} />
          <Route path="/new-route" element={<NewRoute />} />
          <Route path="/register-batch" element={<RegisterBatch />} />
          <Route path="/generate-proof-tag" element={<GenerateProofTag />} />
          <Route path="/route/:id" element={<RouteDetails />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}


