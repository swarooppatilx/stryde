import { Button } from '@repo/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '4rem auto',
        padding: '0 1.5rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>Stryde</h1>
      <p style={{ color: '#666', lineHeight: 1.6 }}>
        Move-to-earn on-chain. Claim territory, verify with World ID, earn tokens.
      </p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <Link href="/verify">
          <Button>Verify with World ID</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="secondary">Dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
