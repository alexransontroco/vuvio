# Firestore Stream Rules

The `streams` backend V1 is server-owned.

- Public clients can read public stream documents.
- Creators can read their own stream documents.
- Clients cannot create, update, or delete `streams` directly.
- Clients cannot write `streamStats` directly.
- Analytics events should go through the backend API.
- Gear documents are readable when public or owned by the current user.
- Gear writes are allowed only for the owner and require `ownerId == request.auth.uid`.
- The legacy `activeLives` collection remains available for the existing WebRTC prototype and should be retired after the backend stream flow replaces it.

Critical live operations must use:

- `POST /api/streams`
- `POST /api/streams/:streamId/start`
- `POST /api/streams/:streamId/heartbeat`
- `POST /api/streams/:streamId/end`
