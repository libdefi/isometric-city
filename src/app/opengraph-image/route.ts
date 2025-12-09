import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Standard OG image dimensions (Twitter card size)
    const width = 1200;
    const height = 630;

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            position: 'relative',
          }}
        >
          {/* Subtle radial glow effect */}
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '800px',
              height: '800px',
              background: 'radial-gradient(circle, rgba(148, 163, 184, 0.08) 0%, transparent 70%)',
              borderRadius: '50%',
            }}
          />

          {/* Main content container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 80px',
              gap: '20px',
            }}
          >
            {/* Main title with elegant styling */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <h1
                style={{
                  fontSize: '128px',
                  fontWeight: 300,
                  letterSpacing: '0.08em',
                  color: '#ffffff',
                  margin: 0,
                  textAlign: 'center',
                  fontFamily: 'serif',
                  lineHeight: 1,
                  textShadow: '0 2px 20px rgba(0, 0, 0, 0.3)',
                }}
              >
                ISOCITY
              </h1>
              
              {/* Decorative line under title */}
              <div
                style={{
                  width: '200px',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.4), transparent)',
                  marginTop: '8px',
                }}
              />
            </div>

            {/* Subtitle */}
            <p
              style={{
                fontSize: '40px',
                fontWeight: 400,
                color: 'rgba(255, 255, 255, 0.75)',
                margin: 0,
                textAlign: 'center',
                letterSpacing: '0.03em',
                fontFamily: 'sans-serif',
                marginTop: '12px',
              }}
            >
              Metropolis Builder
            </p>

            {/* Description text */}
            <p
              style={{
                fontSize: '26px',
                fontWeight: 400,
                color: 'rgba(255, 255, 255, 0.55)',
                margin: 0,
                textAlign: 'center',
                maxWidth: '900px',
                lineHeight: 1.4,
                fontFamily: 'sans-serif',
                marginTop: '16px',
              }}
            >
              Build your dream city with richly detailed isometric graphics
            </p>

            {/* City skyline silhouette decoration */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: '12px',
                marginTop: '48px',
                height: '120px',
              }}
            >
              {[50, 70, 90, 110, 90, 70, 50].map((buildingHeight, i) => (
                <div
                  key={i}
                  style={{
                    width: '48px',
                    height: `${buildingHeight}px`,
                    background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.35) 0%, rgba(148, 163, 184, 0.15) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '2px 2px 0 0',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Bottom accent line */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '6px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(148, 163, 184, 0.4) 20%, rgba(148, 163, 184, 0.4) 80%, transparent 100%)',
            }}
          />
        </div>
      ),
      {
        width,
        height,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    // Return a simple fallback image
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            color: '#ffffff',
            fontSize: '60px',
            fontFamily: 'serif',
          }}
        >
          ISOCITY
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}
