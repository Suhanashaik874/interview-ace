

## Plan: Add Forgot Password Flow

### What will be built

1. **"Forgot password?" link on the sign-in form** (`src/pages/Auth.tsx`) — triggers a password reset email via the backend.

2. **New `/reset-password` page** (`src/pages/ResetPassword.tsx`) — where users land after clicking the email link. Shows a form to set a new password, then redirects to dashboard.

3. **Route registration** in `src/App.tsx` — add `/reset-password` as a public route.

### Technical details

- The forgot password link will show a small inline form (or toggle the existing form) to enter email and call `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.
- The `/reset-password` page will detect the `type=recovery` session from the URL hash, show a new password form, and call `supabase.auth.updateUser({ password })`.
- Both pages will reuse the existing glass-card styling and UI components.

### Files to modify
- `src/pages/Auth.tsx` — add forgot password state/UI
- `src/pages/ResetPassword.tsx` — new file
- `src/App.tsx` — add route

