import { Auth } from '@imtbl/auth';

const required = (name) => {
  const value = import.meta.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const passportInstance = new Auth({
  authenticationDomain: 'https://auth.immutable.com',
  passportDomain: 'https://passport.immutable.com',
  clientId: required('VITE_IMMUTABLE_PASSPORT_CLIENT_ID'),
  redirectUri: required('VITE_IMMUTABLE_REDIRECT_URI'),
  logoutRedirectUri: required('VITE_IMMUTABLE_LOGOUT_URI'),
  logoutMode: 'redirect',
  audience: 'platform_api',
  scope: 'openid offline_access'
});

export async function completePassportRedirect() {
  if (window.location.pathname === new URL(import.meta.env.VITE_IMMUTABLE_REDIRECT_URI).pathname) {
    await passportInstance.loginCallback();
  }
}

export async function signIn() {
  return passportInstance.login();
}

export async function signOut() {
  await passportInstance.logout();
}

export async function passportFetch(path, options = {}) {
  // getIdToken refreshes an expired token when the Passport session permits it.
  // The token remains inside this call and is never persisted or logged here.
  const idToken = await passportInstance.getIdToken();
  if (!idToken) {
    const error = new Error('Sign in with Immutable to continue.');
    error.status = 401;
    throw error;
  }
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (response.status === 401) {
    const error = new Error('Your Passport session expired. Sign in again.');
    error.status = 401;
    throw error;
  }
  if (response.status === 403) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.error?.code === 'PASSPORT_IDENTITY_NOT_LINKED'
      ? 'Your Passport identity is valid but is not linked to a community membership.'
      : 'Your identity does not have permission for this action.');
    error.status = 403;
    throw error;
  }
  return response;
}
