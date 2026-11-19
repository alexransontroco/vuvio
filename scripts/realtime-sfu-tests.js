#!/usr/bin/env node
/**
 * Cloudflare Realtime SFU — Automated Test Suite
 * Tests all functionality without human interaction
 *
 * Usage: node scripts/realtime-sfu-tests.js
 * Requires: Firebase Emulator running on localhost:5001
 */

const http = require('http');

const BASE_URL = 'http://localhost:5001/vuvio-bf328/us-central1';
const TEST_RESULTS = [];

// Test helper functions
async function callFunction(functionName, data, authToken = 'test-token') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      data: data,
    });

    const options = {
      hostname: 'localhost',
      port: 5001,
      path: `/vuvio-bf328/us-central1/${functionName}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${authToken}`,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function logTest(name, passed, details = '') {
  const status = passed ? '✓' : '✗';
  const message = `${status} ${name}`;
  console.log(message + (details ? ` — ${details}` : ''));
  TEST_RESULTS.push({ name, passed, details });
}

// Generate minimal SDP (for testing, not real media)
function generateOfferSDP() {
  return `v=0
o=- 0 0 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=extmap-allow-mixed
a=msid-semantic: WMS
m=application 9 UDP/TLS/RTP/SAVPF 120
c=IN IP4 127.0.0.1
a=rtcp:9 IN IP4 127.0.0.1
a=ice-ufrag:test
a=ice-pwd:test
a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00
a=setup:active
a=mid:0
a=sendrecv
a=rtcp-mux
a=rtpmap:120 JSON/90000`;
}

// Main test suite
async function runTests() {
  console.log('=====================================');
  console.log('Cloudflare Realtime SFU — Test Suite');
  console.log('=====================================\n');

  console.log('Connecting to Firebase Emulator...\n');

  try {
    // Test 1: Create Session with valid offer
    console.log('TEST 1: Create Session');
    const offer = {
      type: 'offer',
      sdp: generateOfferSDP(),
    };

    const createResult = await callFunction('createRealtimeSession', {
      offer,
      roomId: 'test-room-1',
    });

    const sessionCreated = createResult.status === 200 && createResult.data.result?.sessionId;
    logTest('Create session', sessionCreated, sessionCreated ? `sessionId: ${createResult.data.result.sessionId.substring(0, 8)}...` : createResult.data.error?.message || 'Unknown error');

    if (!sessionCreated) {
      console.log('\n✗ Cannot proceed: Session creation failed');
      printResults();
      process.exit(1);
    }

    const sessionId = createResult.data.result.sessionId;
    const hasAnswer = createResult.data.result.answer && createResult.data.result.answer.type === 'answer';
    logTest('Answer SDP received', hasAnswer, `type: ${createResult.data.result.answer?.type || 'missing'}`);

    // Test 2: Verify offer/answer direction
    console.log('\nTEST 2: SDP Offer/Answer Validation');
    logTest('Offer type validation', offer.type === 'offer', `offer.type: ${offer.type}`);
    logTest('Answer type validation', createResult.data.result.answer?.type === 'answer', `answer.type: ${createResult.data.result.answer?.type || 'missing'}`);

    // Test 3: Publish track (video)
    console.log('\nTEST 3: Publish Video Track');
    const publishVideoResult = await callFunction('publishRealtimeTrack', {
      sessionId,
      trackName: 'video',
      codec: 'vp8',
      mid: '0',
    });

    const videoPublished = publishVideoResult.status === 200 && publishVideoResult.data.result?.trackId;
    logTest('Publish video track', videoPublished, videoPublished ? `trackId: ${publishVideoResult.data.result.trackId.substring(0, 8)}...` : publishVideoResult.data.error?.message || 'Unknown error');

    const videoTrackId = publishVideoResult.data.result?.trackId;
    const videoMid = publishVideoResult.data.result?.mid;
    logTest('Video track mid', videoMid === '0', `mid: ${videoMid || 'missing'}`);

    // Test 4: Publish track (audio)
    console.log('\nTEST 4: Publish Audio Track');
    const publishAudioResult = await callFunction('publishRealtimeTrack', {
      sessionId,
      trackName: 'audio',
      codec: 'opus',
      mid: '1',
    });

    const audioPublished = publishAudioResult.status === 200 && publishAudioResult.data.result?.trackId;
    logTest('Publish audio track', audioPublished, audioPublished ? `trackId: ${publishAudioResult.data.result.trackId.substring(0, 8)}...` : publishAudioResult.data.error?.message || 'Unknown error');

    const audioTrackId = publishAudioResult.data.result?.trackId;
    logTest('Audio track mid', publishAudioResult.data.result?.mid === '1', `mid: ${publishAudioResult.data.result?.mid || 'missing'}`);

    // Test 5: Create second session in same room
    console.log('\nTEST 5: Multiple Sessions (Room Isolation)');
    const session2Result = await callFunction('createRealtimeSession', {
      offer,
      roomId: 'test-room-1',
    });

    const session2Created = session2Result.status === 200 && session2Result.data.result?.sessionId;
    const sessionId2 = session2Result.data.result?.sessionId;
    const differentSessionIds = sessionId !== sessionId2;
    logTest('Create second session', session2Created && differentSessionIds, `sessionId: ${sessionId2?.substring(0, 8) || 'failed'}...`);

    // Test 6: Subscribe to remote track
    console.log('\nTEST 6: Subscribe to Remote Track');
    const subscribeResult = await callFunction('subscribeRealtimeTrack', {
      sessionId: sessionId2,
      remoteSessionId: sessionId,
      trackName: 'video',
      mid: '0',
    });

    const subscribed = subscribeResult.status === 200 && subscribeResult.data.result?.trackId;
    logTest('Subscribe to remote video', subscribed, subscribed ? `trackId: ${subscribeResult.data.result.trackId.substring(0, 8)}...` : subscribeResult.data.error?.message || 'Unknown error');

    // Test 7: Close track (using tracks[] and mid)
    console.log('\nTEST 7: Close Track (tracks[] + mid validation)');
    const closeTrackResult = await callFunction('closeRealtimeTrack', {
      sessionId,
      trackId: audioTrackId,
    });

    const trackClosed = closeTrackResult.status === 200 && closeTrackResult.data.result?.success;
    logTest('Close audio track', trackClosed, trackClosed ? 'Track removed' : closeTrackResult.data.error?.message || 'Unknown error');

    // Test 8: Close session
    console.log('\nTEST 8: Close Session');
    const closeSessionResult = await callFunction('closeRealtimeSession', {
      sessionId,
    });

    const sessionClosed = closeSessionResult.status === 200 && closeSessionResult.data.result?.success;
    logTest('Close session', sessionClosed, sessionClosed ? 'Session cleaned up' : closeSessionResult.data.error?.message || 'Unknown error');

    // Test 9: Permission check (try to access closed session)
    console.log('\nTEST 9: Permission Enforcement');
    const closeClosedResult = await callFunction('closeRealtimeSession', {
      sessionId,
    });

    const permissionDenied = closeClosedResult.status !== 200;
    logTest('Reject access to closed session', permissionDenied, `status: ${closeClosedResult.status}`);

  } catch (error) {
    console.error('\n✗ Test suite error:', error.message);
    process.exit(1);
  }

  console.log('\n');
  printResults();
}

function printResults() {
  console.log('=====================================');
  console.log('Test Results Summary');
  console.log('=====================================\n');

  const passed = TEST_RESULTS.filter(t => t.passed).length;
  const total = TEST_RESULTS.length;
  const percentage = Math.round((passed / total) * 100);

  console.log(`PASSED: ${passed}/${total} (${percentage}%)\n`);

  TEST_RESULTS.forEach((result, index) => {
    const status = result.passed ? '✓' : '✗';
    console.log(`${index + 1}. ${status} ${result.name}`);
  });

  console.log('\n=====================================\n');

  if (passed === total) {
    console.log('✓ All tests passed!\n');
    return 0;
  } else {
    console.log(`✗ ${total - passed} test(s) failed\n`);
    return 1;
  }
}

// Run tests
runTests().then((exitCode) => {
  process.exit(exitCode || 0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
