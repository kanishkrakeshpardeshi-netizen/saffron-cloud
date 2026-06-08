import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return JSON.parse(atob(base64));
  } catch (e) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const tokenObj = request.cookies.get('auth_token');
  const token = tokenObj ? tokenObj.value : undefined;
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register');

  let isAdmin = false;
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload && payload.role === 'admin') {
      isAdmin = true;
    }
  }

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isAuthPage) {
    // Admin is allowed to access register page to create new farmer nodes
    if (request.nextUrl.pathname.startsWith('/register') && isAdmin) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    
    '/((?!api|_next/static|_next/image|favicon.ico|hero.png).*)',
  ],
};
