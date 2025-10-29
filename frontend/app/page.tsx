import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <h1>🏠 Home Page</h1>
      <p>This is the front end running as an SPA.</p>
      <Link href="/data">
        <button style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Go to Data Page</button>
      </Link>
    </div>
  )
}
