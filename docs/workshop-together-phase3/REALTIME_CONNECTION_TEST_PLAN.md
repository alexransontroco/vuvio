# Cloudflare Realtime SFU — Connection Test Plan

**Purpose:** Verify real WebRTC connections work end-to-end before production deployment.

---

## Prerequisites

- Two physical devices (iPhone + Android, or two browsers on different machines)
- Both devices on same network OR ngrok tunnel configured
- Firebase Emulator running locally
- CF_APP_ID + CF_APP_SECRET configured in `functions/.env.local`
- Two Firebase Auth users (test-user-a@example.com, test-user-b@example.com)

---

## Test 1: Firebase Emulator — Room Isolation

**Purpose:** Verify Firestore rules enforce room-level access control.

**Setup:**
```bash
firebase emulators:start --only firestore,functions
# In another terminal:
firebase auth:import test-users.json --hash-algo=bcrypt
```

**Test User A:**
1. Authenticate as test-user-a@example.com
2. Call Firebase Function: `createRealtimeSession({ offer: {...}, roomId: 'room-1' })`
3. Verify: Firestore rtcSessions/{sessionId} created with:
   - userId: uid-of-user-a
   - roomId: 'room-1'
   - status: 'active'

**Test User B (Different Room):**
1. Authenticate as test-user-b@example.com
2. Call Firebase Function: `createRealtimeSession({ offer: {...}, roomId: 'room-2' })`
3. Verify: Different sessionId created
4. Try: `subscribeRealtimeTrack({ sessionId: session-b, remoteSessionId: session-a, trackName: 'video', mid: '0' })`
5. Expected: 403 Forbidden ("Remote session in different room")

**Test User C (Same Room as A):**
1. Authenticate as a third user
2. Call: `createRealtimeSession({ offer: {...}, roomId: 'room-1' })` (same roomId as A)
3. Verify: New sessionId created with roomId='room-1'
4. Try: `subscribeRealtimeTrack({ sessionId: session-c, remoteSessionId: session-a, trackName: 'video', mid: '0' })`
5. Expected: 200 OK (same room, can subscribe)

---

## Test 2: Real WebRTC Connection — Device A

**Setup:**
```bash
npm run dev
# Open http://localhost:5173/admin/realtime-test on Device A (or desktop browser)
```

**Manual Test:**
1. Click "Create / Join Room"
2. Inspect Firestore (Emulator UI or console): Verify rtcSessions document created
3. Check browser console: Should show:
   - sessionId
   - Local media stream active
   - RTCPeerConnection state: "connected" or "new"
4. Keep room open (do NOT leave)

---

## Test 3: Real WebRTC Connection — Device B Joins Room A

**Setup:**
On Device B: Use same URL (via ngrok or local network)

**Manual Test:**
1. Copy Room ID from Device A display
2. On Device B: Paste Room ID in input
3. Click "Create / Join Room"
4. Verify:
   - Device B gets sessionId (different from A)
   - Both devices' Firestore records show roomId (should match)
   - Both devices: participant count = 2

---

## Test 4: Bidirectional Media — Device A → Device B

**Manual Test:**
1. Device A: Check local video preview (should show Device A's camera)
2. Device B: Check remote video grid (should show Device A's video)
3. Device A speaks: Device B should hear audio
4. Monitor Device B browser console: Should show track subscriptions logged

**Verification Points:**
- RTCPeerConnection stats available (via getStats())
- Latency reported (should be <300ms on local network)
- Bitrate measured
- Video resolution detected

---

## Test 5: Bidirectional Media — Device B → Device A

**Manual Test:**
1. Device B: Check local video preview (should show Device B's camera)
2. Device A: Check remote video grid (should show Device B's video)
3. Device B speaks: Device A should hear audio

**Verification Points:**
- Same as Test 4 (symmetric)

---

## Test 6: Media Controls

### Camera Toggle
1. Device A: Click "Camera Off" button
2. Device B: Device A's video should freeze or become blank
3. Device A: Click "Camera On" button
4. Device B: Device A's video should resume

### Microphone Toggle
1. Device A: Click "Mic Off" button
2. Device B: Device A's audio should mute
3. Device A: Click "Mic On" button
4. Device B: Device A's audio should resume

### Audio-Only Mode
1. Device A: Click "Audio Only" button
2. Verify: Camera toggle disabled, video track disabled
3. Device B: Device A's video should stop (audio continues)
4. Device A: Audio continues to Device B

---

## Test 7: Network Interruption

**Setup:**
On Device A: Chrome DevTools → Network tab

**Manual Test:**
1. Simulate poor network: DevTools → Throttling → "Slow 3G"
2. Measure: Latency should increase, bitrate should adapt
3. Remove throttling
4. Verify: Connection recovers to normal latency/bitrate

**Wi-Fi Interrupt:**
1. While connected, disable Device A's Wi-Fi
2. Device A: Should show "Connection lost" (after 15-30s timeout)
3. Re-enable Wi-Fi
4. Verify: Automatic reconnection OR manual "Reconnect" button

---

## Test 8: Session Cleanup

**Manual Test:**
1. Device A: Click "Leave Room" button
2. Verify: Firestore rtcSessions/{sessionId} status = 'closed'
3. Verify: Browser closes RTCPeerConnection
4. Device B: Should detect disconnect (participant count decreases)

---

## Test 9: Firestore Audit Log

**Purpose:** Verify server-side logging for access control verification.

**Checks:**
1. After Test 1-8, examine Firestore:
   ```
   rtcSessions/{sessionId}
   - userId: ✓ (matches auth user)
   - roomId: ✓ (consistent within room)
   - tracks[]: ✓ (array of published/subscribed tracks)
   - status: ✓ (active → closed transition)
   - timestamps: ✓ (createdAt, closedAt, etc.)
   ```

2. Per-track metadata:
   ```
   tracks[0]:
   - trackId: ✓ (from CF SFU)
   - mid: ✓ (matches WebRTC mid)
   - trackName: ✓ (video/audio)
   - codec: ✓ (vp8/opus)
   - location: ✓ (local/remote)
   - publishedAt/subscribedAt: ✓ (timestamp)
   ```

---

## Test 10: Permission Verification

**Purpose:** Verify server-side permission checks work correctly.

**Test: Unauthorized Track Subscribe**
1. User A creates session in room-1, publishes video track
2. User B creates session in room-2
3. User B attempts: `subscribeRealtimeTrack({ sessionId: b, remoteSessionId: a, ... })`
4. Expected: 403 Forbidden (different room)
5. Verify: Firestore shows NO track added to User B's session

**Test: Session Ownership**
1. User A creates session-a
2. User B attempts: `closeRealtimeSession({ sessionId: a })`
3. Expected: 403 Forbidden (not owner)
4. Verify: Firestore rtcSessions/{a} status still = 'active'

---

## Test 11: Scaling to 3+ Participants

**Setup:**
Add Device C (or third browser tab with different user)

**Manual Test:**
1. Device A, B, C all join room-1
2. Verify:
   - Each device gets unique sessionId
   - All sessionIds have roomId='room-1'
   - Participant count = 3 on all devices
3. Media Matrix (3×3):
   - A sees: B's video + C's video
   - B sees: A's video + C's video
   - C sees: A's video + B's video
4. All audio streams should mix (browser handles this)

**Performance Check:**
- Latency should still be <300ms
- Bitrate should adapt (3×bandwidth ~= 3× bitrate)
- CPU usage on each device should be monitored

---

## Test 12: Mobile Devices

**Setup:**
iPhone Safari + Android Chrome, same local network

**Manual Test:**
1. iPhone: Open HTTPS URL (ngrok or localhost)
2. Android: Open same URL
3. Grant camera + microphone permissions
4. Repeat Tests 4-6 (bidirectional media, controls)
5. Special checks:
   - **iOS audio during screen lock:** ⚠️ Known limitation (documented)
   - **Bluetooth headphones:** Should work for audio
   - **Network switching:** Wi-Fi ↔ cellular should handle gracefully

---

## Troubleshooting

### "No sessionId in response"
- Check: CF_APP_ID + CF_APP_SECRET are correct
- Check: `https://rtc.live.cloudflare.com/v1` is accessible from server
- Check: Bearer token format in Authorization header

### "Remote session in different room"
- Expected if testing room isolation
- Verify: Firestore roomId values match between sessions
- Check: subscribeRealtimeTrack validates roomId before CF API call

### "Connection failed after 15s"
- Check: Browser console for WebRTC errors (ICE candidates, connection state)
- Check: Network connectivity (Emulator not running, bad Wi-Fi)
- Check: CF SFU session not created (createRealtimeSession returned error)

### No remote video visible
- Check: Remote user's camera is ON
- Check: subscribeRealtimeTrack succeeded (no errors in console)
- Check: Browser DevTools → WebRTC internals (video decoder active)
- Check: RTCPeerConnection stats → inbound-rtp video

---

## Success Criteria

All tests MUST pass before production deployment:

- [ ] Test 1: Room isolation enforced
- [ ] Test 2: Device A WebRTC connects
- [ ] Test 3: Device B joins room, gets sessionId
- [ ] Test 4: Device A → Device B media works
- [ ] Test 5: Device B → Device A media works
- [ ] Test 6: Media controls work (camera, mic, audio-only)
- [ ] Test 7: Network resilience (throttling, reconnection)
- [ ] Test 8: Session cleanup works
- [ ] Test 9: Firestore audit log accurate
- [ ] Test 10: Permission checks prevent unauthorized access
- [ ] Test 11: 3+ participants work correctly
- [ ] Test 12: Mobile devices work (iOS audio-only limitation documented)

---

## Notes

- **Never deploy to production without passing all tests**
- **Monitor browser console for all error messages**
- **Check Firebase Functions logs for server-side errors**
- **Record latency/bitrate metrics for performance baseline**
- **Test on 2+ different networks (home Wi-Fi, cellular, work network)**
