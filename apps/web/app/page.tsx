import Link from 'next/link';

const linkStyle = {
  padding: '0.6rem 1.25rem',
  borderRadius: 8,
  textDecoration: 'none',
  fontWeight: 600,
} as const;

const primaryLinkStyle = { ...linkStyle, background: '#111', color: '#fff' };
const secondaryLinkStyle = { ...linkStyle, background: '#eee', color: '#111' };

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
        <Link href="/verify" style={primaryLinkStyle}>
          Verify with World ID
        </Link>
        <Link href="/dashboard" style={secondaryLinkStyle}>
          Dashboard
        </Link>
      </div>
    </main>
  );
}
