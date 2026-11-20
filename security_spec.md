# Security Specification — Blox Hub Accounts

## 1. Data Invariants
1. A `/users/{userId}` document can only be created or modified by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`), with `role == 'player'`.
2. Private PII (`email`, `displayName`) MUST reside strictly in `/users/{userId}/private/info` and is readable/writable ONLY by `request.auth.uid == userId`.
3. Every `createdAt` and `updatedAt` timestamp MUST equal `request.time`, and `createdAt` + `uid` + `role` are immutable after creation.
4. No list query can return another user's `/users` document (`resource.data.uid == request.auth.uid`).
5. Unlocked item lists (`ownedItems`) MUST be a list of at most 50 string IDs.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Unauthenticated Create**: Create `/users/u1` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Create**: Create `/users/u1` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **UID Spoofing**: Authenticated as `u1`, create `/users/u1` with `{ uid: "u2", ... }` -> `PERMISSION_DENIED`.
4. **Cross-User Write**: Authenticated as `u1`, create/update `/users/u2` -> `PERMISSION_DENIED`.
5. **Privilege Escalation (Role Injection)**: Create `/users/u1` with `{ role: "admin" }` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection**: Create `/users/u1` with extra key `isAdmin: true` -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Attempt `get` or `create` at `/users/` + 1500-char ID -> `PERMISSION_DENIED`.
8. **Invalid Username Pattern**: Create `/users/u1` with `username: "bad name! <script>"` -> `PERMISSION_DENIED`.
9. **Timestamp Forgery**: Create `/users/u1` with client-supplied `createdAt: "2020-01-01"` -> `PERMISSION_DENIED`.
10. **Immutable Role Update**: Update `/users/u1` changing `role` from `'player'` to `'admin'` -> `PERMISSION_DENIED`.
11. **PII Leak Read**: Authenticated as `u2`, `get(/users/u1/private/info)` -> `PERMISSION_DENIED`.
12. **Blanket List Scrape**: Authenticated as `u2`, `list(/users)` without `where('uid', '==', 'u2')` -> `PERMISSION_DENIED`.
