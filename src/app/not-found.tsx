'use client';

import Link from 'next/link';

/**
 * Not found page for the application.
 * This handles 404 errors.
 */
export default function NotFound() {
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
      <h1 style={{ fontSize: '4rem', marginBottom: '0.5rem', color: '#d4af37' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Page Not Found</h2>
      <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#d4af37',
          color: '#0f1219',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
