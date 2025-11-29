'use client';

/**
 * Error boundary for the application.
 * This handles runtime errors.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#0f1219',
        color: '#e5e5e5',
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong!</h1>
      <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
        {error.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#d4af37',
          color: '#0f1219',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Try again
      </button>
    </div>
  );
}
