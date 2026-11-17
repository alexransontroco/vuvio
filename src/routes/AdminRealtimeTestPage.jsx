import { useState, useRef, useEffect, useMemo } from 'react';
import { Video, Mic, MicOff, VideoOff, LogOut, Plus, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { functions } from '../firebase.js';
import { httpsCallable } from 'firebase/functions';
import '../styles/pages/admin-realtime-test.css';

export default function AdminRealtimeTestPage() {
  const { user } = useAuth();
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState({
    connectionStatus: 'disconnected',
    participantCount: 0,
    latency: 0,
    bitrate: 0,
    packetLoss: 0,
    videoResolution: '0x0',
    sessionDuration: 0,
    estimatedBandwidth: 0,
    estimatedCost: 0,
  });

  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const peerConnectionRef = useRef(null);
  const sessionStartRef = useRef(Date.now());
  const sessionIdRef = useRef(null);

  const createSFUSession = async () => {
    try {
      setLoading(true);
      setError('');

      // Initialize local media first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setLocalStream(stream);

      // Create WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          { urls: ['stun:stun1.l.google.com:19302'] },
        ],
      });

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Call Firebase Function to create SFU session
      const createRealtimeSession = httpsCallable(functions, 'createRealtimeSession');
      const result = await createRealtimeSession({
        offer: {
          type: 'offer',
          sdp: offer.sdp,
        },
      });

      // Set remote answer
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp: result.data.answer.sdp,
        })
      );

      sessionIdRef.current = result.data.sessionId;
      setRoomId(result.data.sessionId || `room-${Date.now()}`);
      peerConnectionRef.current = pc;

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log('[RTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setError('Connection lost');
        }
      };

      setIsJoined(true);
      sessionStartRef.current = Date.now();
      updateDiagnostics();
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error('[RTC Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCamera = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleAudioOnly = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = audioOnly; // Disable video if switching to audio-only
      });
      setAudioOnly(!audioOnly);
      setCameraOn(audioOnly); // Update camera state
    }
  };

  const leaveRoom = async () => {
    try {
      if (sessionIdRef.current) {
        const closeRealtimeSession = httpsCallable(functions, 'closeRealtimeSession');
        await closeRealtimeSession({ sessionId: sessionIdRef.current });
      }
    } catch (err) {
      console.error('Error closing session:', err);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    setIsJoined(false);
    setRoomId('');
    setParticipants([]);
    sessionIdRef.current = null;
    setDiagnostics({
      connectionStatus: 'disconnected',
      participantCount: 0,
      latency: 0,
      bitrate: 0,
      packetLoss: 0,
      videoResolution: '0x0',
      sessionDuration: 0,
      estimatedBandwidth: 0,
      estimatedCost: 0,
    });
  };

  const updateDiagnostics = async () => {
    const now = Date.now();
    const duration = Math.floor((now - sessionStartRef.current) / 1000);

    let latency = 0;
    let bitrate = 0;
    let packetLoss = 0;

    if (peerConnectionRef.current && isJoined) {
      try {
        const stats = await peerConnectionRef.current.getStats();
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            bitrate = (report.bytesReceived / (duration || 1)) * 8 / 1000; // kbps
            if (report.packetsLost && report.packetsReceived) {
              packetLoss = (report.packetsLost / (report.packetsLost + report.packetsReceived)) * 100;
            }
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            latency = report.currentRoundTripTime * 1000; // ms
          }
        });
      } catch (err) {
        console.error('Stats error:', err);
      }
    }

    setDiagnostics((prev) => ({
      connectionStatus: peerConnectionRef.current?.connectionState || 'disconnected',
      participantCount: participants.length + 1,
      latency: latency || 0,
      bitrate: bitrate || 0,
      packetLoss: packetLoss || 0,
      videoResolution: audioOnly ? 'audio-only' : '1280x720',
      sessionDuration: duration,
      estimatedBandwidth: (bitrate * duration) / 8 / 1024 / 1024, // MB
      estimatedCost: 0, // Free tier SFU
    }));
  };

  // Update diagnostics every 2 seconds
  useEffect(() => {
    if (isJoined) {
      const interval = setInterval(updateDiagnostics, 2000);
      return () => clearInterval(interval);
    }
  }, [isJoined, audioOnly]);

  // Setup local video preview
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (!user) {
    return (
      <div className="realtime-test admin-only-banner">
        <p>Admin access required. Please log in.</p>
      </div>
    );
  }

  return (
    <div className="realtime-test">
      <div className="realtime-test__header">
        <h1>Cloudflare Realtime SFU — PoC Test</h1>
        <p className="realtime-test__subtitle">Test real audio/video communication between multiple devices</p>
      </div>

      {error && <div className="realtime-test__error">{error}</div>}

      <div className="realtime-test__layout">
        {/* Control Panel */}
        <div className="realtime-test__panel">
          <h2>Room Control</h2>

          {!isJoined ? (
            <div className="realtime-test__form">
              <input
                type="text"
                placeholder="Room ID (auto-generated)"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="realtime-test__input"
              />
              <button
                onClick={createSFUSession}
                disabled={loading}
                className="realtime-test__button realtime-test__button--primary"
              >
                {loading ? <Loader className="spin" size={18} /> : <Plus size={18} />}
                {loading ? 'Connecting...' : 'Create / Join Room'}
              </button>
            </div>
          ) : (
            <div className="realtime-test__info">
              <div className="realtime-test__info-item">
                <span>Room ID:</span>
                <code>{roomId}</code>
              </div>
              <button onClick={leaveRoom} className="realtime-test__button realtime-test__button--danger">
                <LogOut size={18} />
                Leave Room
              </button>
            </div>
          )}

          {/* Media Controls */}
          {isJoined && (
            <div className="realtime-test__controls">
              <h3>Media Controls</h3>
              <button
                onClick={toggleCamera}
                className={`realtime-test__button ${cameraOn ? 'active' : 'disabled'}`}
              >
                {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                {cameraOn ? 'Camera On' : 'Camera Off'}
              </button>
              <button
                onClick={toggleMic}
                className={`realtime-test__button ${micOn ? 'active' : 'disabled'}`}
              >
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                {micOn ? 'Mic On' : 'Mic Off'}
              </button>
              <button
                onClick={toggleAudioOnly}
                className={`realtime-test__button ${audioOnly ? 'active' : ''}`}
              >
                Audio Only
              </button>
            </div>
          )}
        </div>

        {/* Video Preview */}
        <div className="realtime-test__videos">
          {localStream && (
            <div className="realtime-test__video-container realtime-test__video--local">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="realtime-test__video"
              />
              <div className="realtime-test__video-label">You</div>
            </div>
          )}

          {/* Remote Participants */}
          {participants.map((participant) => (
            <div key={participant.id} className="realtime-test__video-container">
              <video
                ref={(el) => {
                  if (el) remoteVideoRefs.current.set(participant.id, el);
                }}
                autoPlay
                playsInline
                className="realtime-test__video"
              />
              <div className="realtime-test__video-label">{participant.name}</div>
            </div>
          ))}

          {/* Empty State */}
          {!localStream && (
            <div className="realtime-test__empty">
              <p>Click "Create / Join Room" to begin</p>
            </div>
          )}
        </div>

        {/* Diagnostics Panel */}
        {isJoined && (
          <div className="realtime-test__diagnostics">
            <h2>Diagnostics</h2>
            <div className="realtime-test__diag-grid">
              <div className="realtime-test__diag-item">
                <span className="label">Status</span>
                <span className={`value ${diagnostics.connectionStatus}`}>{diagnostics.connectionStatus}</span>
              </div>
              <div className="realtime-test__diag-item">
                <span className="label">Participants</span>
                <span className="value">{diagnostics.participantCount}</span>
              </div>
              <div className="realtime-test__diag-item">
                <span className="label">Latency</span>
                <span className="value">{diagnostics.latency.toFixed(0)} ms</span>
              </div>
              <div className="realtime-test__diag-item">
                <span className="label">Bitrate</span>
                <span className="value">{(diagnostics.bitrate / 1024).toFixed(1)} Mbps</span>
              </div>
              <div className="realtime-test__diag-item">
                <span className="label">Packet Loss</span>
                <span className="value">{diagnostics.packetLoss.toFixed(2)} %</span>
              </div>
              <div className="realtime-test__diag-item">
                <span className="label">Resolution</span>
                <span className="value">{diagnostics.videoResolution}</span>
              </div>
              <div className="realtime-test__diag-item">
                <span className="label">Duration</span>
                <span className="value">{diagnostics.sessionDuration} s</span>
              </div>
              <div className="realtime-test__diag-item">
                <span className="label">Bandwidth (est.)</span>
                <span className="value">{diagnostics.estimatedBandwidth.toFixed(2)} MB</span>
              </div>
              <div className="realtime-test__diag-item">
                <span className="label">Cost (est.)</span>
                <span className="value">${diagnostics.estimatedCost.toFixed(4)}</span>
              </div>
            </div>
            <div className="realtime-test__info-box">
              <strong>Note:</strong> Free tier covers 1 GB/month egress. This PoC typically uses 450 MB/hour for 2 participants.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
