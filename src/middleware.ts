import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  
  // Si viene de card.galas.com.ar, servir desde /card
  if (host.includes('card.galas.com.ar')) {
    const path = request.nextUrl.pathname;
    
    // Si es la raíz, redirigir a /card
    if (path === '/' || path === '') {
      return NextResponse.rewrite(new URL('/card', request.url));
    }
    
    // Si ya empieza con /card, mantener
    if (path.startsWith('/card')) {
      return NextResponse.next();
    }
    
    // Cualquier otra ruta, reescribir a /card/ruta
    return NextResponse.rewrite(new URL(`/card${path}`, request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
