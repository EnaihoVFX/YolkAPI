import { Link } from 'react-router-dom'
import { Badge } from '../components/UI'
import { Delivery, useDeliveries } from '../lib/api'
import { useNavigate } from 'react-router-dom'

export function DeliveryFeed() {
  const { data } = useDeliveries()
  const navigate = useNavigate()
  return (
    <section>
      <h1>Delivery Activity</h1>
      <div className="list">
        {data.map((d: Delivery) => (
          <div key={d.id} className="item">
            <div className="row">
              <div>
                <div className="amount">{d.id}</div>
                <div className="date">{new Date(d.startedIso).toLocaleString()}</div>
              </div>
              <Badge color={d.status === 'in_transit' ? 'yellow' : d.status === 'delivered' ? 'green' : 'red'}>{d.status}</Badge>
            </div>
            <div className="row">
              <div className="muted">Distributor: {d.distributor}</div>
              <button className="link" onClick={() => navigate(`/delivery/${encodeURIComponent(d.id)}`)}>View route →</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}


