'use client';

export const dynamic = 'force-dynamic';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
          <h1>Something went wrong!</h1>
          <p>{error?.message || 'An error occurred'}</p>
          <button onClick={() => typeof reset === 'function' && reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
