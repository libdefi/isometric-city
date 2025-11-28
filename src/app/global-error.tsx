'use client';

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1219' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>Something went wrong!</h2>
            <p style={{ color: '#9ca3af' }}>Please refresh the page</p>
          </div>
        </div>
      </body>
    </html>
  );
}
