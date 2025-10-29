import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function DataPage() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('/api/hello')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Failed to fetch backend 😢'))
  }, [])

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <h1>📡 Data Page</h1>
      <p>Backend says: {message}</p>
      <Link href="/">
        <button style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Back Home</button>
      </Link>
    </div>
  )
}
