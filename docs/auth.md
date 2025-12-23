# Authentication: Register, Login, Logout

This document describes the API endpoints for user registration, login and logout.

**Base path**: `/api/auth`

**Notes**:
- Tokens: the server issues an `accessToken` (short-lived JWT) in JSON responses and a `refreshToken` in an HTTP-only cookie named `refreshToken`.
- Error responses use standard HTTP status codes (`400`, `401`, `403`, `500`) with a JSON message `{ "message": "..." }`.

**Register**
- **Method**: `POST`
- **Path**: `/register`
- **Description**: Create a new user and receive an `accessToken` and set a `refreshToken` cookie.
- **Request body (JSON)**:
  - **name**: string — full name (required)
  - **username**: string — unique username (required)
  - **password**: string — plain password, min length enforced by server (required)
  - **role**: string — one of `admin`, `supervisor` (required)
- **Success response (201)**:
  ```json
  {
    "accessToken": "<jwt>",
    "user": {
      "id": "<mongoId>",
      "name": "Shahroz Ahmed",
      "username": "shahroz769",
      "role": "admin"
    }
  }
  ```
  - Also sets an HTTP-only cookie `refreshToken` scoped to the app.
- **Common errors**:
  - `400` — missing fields: `{ "message": "All fields are required" }`
  - `400` — user exists: `{ "message": "User already exists" }`
  - `500` — server error

**Login**
- **Method**: `POST`
- **Path**: `/login`
- **Description**: Authenticate a user; returns an `accessToken` and sets `refreshToken` cookie.
- **Request body (JSON)**:
  - **username**: string (required)
  - **password**: string (required)
- **Success response (200)**:
  ```json
  {
    "accessToken": "<jwt>",
    "user": {
      "id": "<mongoId>",
      "name": "Shahroz Ahmed",
      "username": "shahroz769",
      "role": "admin"
    }
  }
  ```
  - `refreshToken` cookie (HTTP-only) is set/updated.
- **Common errors**:
  - `400` — missing fields
  - `401` — invalid credentials: `{ "message": "Invalid username or password" }`
  - `500` — server error

**Logout**
- **Method**: `POST` (or `GET` depending on implementation)
- **Path**: `/logout`
- **Description**: Clears the `refreshToken` cookie on the client to log out the session.
- **Request**: no body required; client should send cookie automatically
- **Success response (200)**:
  ```json
  { "message": "Logged out" }
  ```
- **Notes**:
  - The server clears the `refreshToken` cookie (e.g., `res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax' })`).
  - To fully invalidate tokens, server-side refresh-token revocation may be required (not covered here).

**Cookie details**
- **Name**: `refreshToken`
- **Flags**: `HttpOnly`, `secure` in production, `sameSite` typically `lax` or `none` (for cross-site).
- **Expiry**: long-lived (e.g., 30 days)

**Usage examples (curl)**
- Register:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Shahroz Ahmed","username":"shahroz769","password":"Asd@36766","role":"admin"}'
```
- Login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"shahroz769","password":"Asd@36766"}' -c cookies.txt
```
- Logout (using saved cookies):
```bash
curl -X POST http://localhost:5000/api/auth/logout -b cookies.txt -c cookies.txt
```

**Notes & troubleshooting**
- Ensure your client sends `Content-Type: application/json` and that the request body keys match `username`, `password`, `name`, `role` exactly.
- If you see validation errors like `All fields are required`, confirm the JSON keys and that the server receives `req.body` (check that `express.json()` middleware is enabled).
- If tokens are not persisted across requests, check cookie `sameSite`/`secure` settings and whether the client is on a different origin.

