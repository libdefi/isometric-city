import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// Static list of game screenshots
const GAME_IMAGES = [
  'IMG_6902.PNG',
  'IMG_6903.PNG',
  'IMG_6904.PNG',
  'IMG_6906.PNG',
  'IMG_6907.PNG',
  'IMG_6908.PNG',
  'IMG_6909.PNG',
  'IMG_6910.PNG',
  'IMG_6911.PNG',
];

// Use a static image for OG generation (first image in the list)
const STATIC_OG_IMAGE = GAME_IMAGES[0];

export async function GET() {
  try {
    // Read the static image file directly from the public folder
    const imagePath = path.join(process.cwd(), 'public', 'games', STATIC_OG_IMAGE);
    const imageBuffer = await readFile(imagePath);
    
    // Return the image directly with proper headers for social media crawlers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error serving OG image:', error);
    
    // Fallback to the static og-image.png
    try {
      const fallbackPath = path.join(process.cwd(), 'public', 'og-image.png');
      const fallbackBuffer = await readFile(fallbackPath);
      
      return new NextResponse(fallbackBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': fallbackBuffer.length.toString(),
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    } catch {
      return new NextResponse('Image not found', { status: 404 });
    }
  }
}
