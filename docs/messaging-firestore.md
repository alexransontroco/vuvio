# Vuvio Messaging Firestore Plan

This app currently uses local mock data for messaging. When Firebase is added, use this structure.

## Collections

`conversations/{conversationId}`

- `participantIds: string[]`
- `participantProfiles: map`
- `createdAt: timestamp`
- `updatedAt: timestamp`
- `lastMessage: string`
- `lastMessageAt: timestamp`
- `lastMessageSenderId: string`
- `unreadCountByUser: map`
- `requestStatusByUser: map`
- `relatedLiveId: string | null`
- `relatedReplayId: string | null`
- `mutedBy: string[]`
- `blockedBy: string[]`
- `deletedBy: string[]`

`conversations/{conversationId}/messages/{messageId}`

- `senderId: string`
- `type: "text" | "live" | "replay" | "profile" | "location" | "system"`
- `text: string | null`
- `createdAt: timestamp`
- `readAt: timestamp | null`
- `status: "sending" | "sent" | "delivered" | "read" | "failed"`
- `liveId: string | null`
- `replayId: string | null`
- `profileId: string | null`
- `location: map | null`
- `metadata: map`

## Rules Sketch

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isParticipant(conversationId) {
      return signedIn()
        && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantIds;
    }

    function validMessageType(type) {
      return type in ['text', 'live', 'replay', 'profile', 'location', 'system'];
    }

    match /conversations/{conversationId} {
      allow read: if isParticipant(conversationId);
      allow create: if signedIn() && request.auth.uid in request.resource.data.participantIds;
      allow update: if isParticipant(conversationId)
        && request.resource.data.participantIds == resource.data.participantIds;

      match /messages/{messageId} {
        allow read: if isParticipant(conversationId);
        allow create: if isParticipant(conversationId)
          && request.resource.data.senderId == request.auth.uid
          && validMessageType(request.resource.data.type)
          && (!('text' in request.resource.data) || request.resource.data.text.size() <= 2000);
        allow update, delete: if false;
      }
    }
  }
}
```
