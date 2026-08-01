import { useEffect, useState } from 'react';

export default function CloudflareTestPage() {
  const [config, setConfig] = useState(null);
  const [liveInputs, setLiveInputs] = useState([]);
  const [selectedInput, setSelectedInput] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchLiveInputs();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/cloudflare/config');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(`Config fetch failed: ${err.message}`);
    }
  };

  const fetchLiveInputs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cloudflare/inputs');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setLiveInputs(data.inputs || []);
    } catch (err) {
      setError(`Inputs fetch failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createTestInput = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/cloudflare/create-test-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      alert(`Created: ${data.input.name}\nUID: ${data.input.uid}`);
      await fetchLiveInputs();
    } catch (err) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Cloudflare Stream Diagnostic</h1>

      {/* Configuration Status */}
      <section style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h2>Configuration Status</h2>
        {config ? (
          <div>
            <p><strong>Account ID:</strong> {config.accountIdConfigured ? '✅ Configured' : '❌ Missing'}</p>
            <p><strong>API Token:</strong> {config.apiTokenConfigured ? '✅ Configured' : '❌ Missing'}</p>
            <p><strong>Webhook Secret:</strong> {config.webhookSecretConfigured ? '✅ Configured' : '❌ Missing'}</p>
            <p><strong>Customer Code:</strong> {config.customerCodeConfigured ? '✅ Configured' : '❌ Missing'}</p>
            {config.customerCode && <p><strong>Customer Code Value:</strong> {config.customerCode}</p>}
            {config.message && <p style={{ color: '#d9534f' }}><strong>⚠️ {config.message}</strong></p>}
          </div>
        ) : (
          <p>Loading configuration...</p>
        )}
      </section>

      {/* Live Inputs List */}
      <section style={{ marginBottom: '30px' }}>
        <h2>Live Inputs</h2>
        {loading ? (
          <p>Loading live inputs...</p>
        ) : error ? (
          <p style={{ color: '#d9534f' }}>⚠️ {error}</p>
        ) : liveInputs.length === 0 ? (
          <p>No live inputs found.</p>
        ) : (
          <div>
            {liveInputs.map((input) => (
              <div
                key={input.uid}
                onClick={() => setSelectedInput(input)}
                style={{
                  padding: '12px',
                  marginBottom: '10px',
                  backgroundColor: selectedInput?.uid === input.uid ? '#e8f4f8' : '#f9f9f9',
                  border: `1px solid ${selectedInput?.uid === input.uid ? '#0066cc' : '#ddd'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <p><strong>{input.name}</strong></p>
                <p>UID: {input.uid}</p>
                <p>Status: {input.connected ? '🟢 Connected' : '⚪ Idle'}</p>
                <p>HLS Manifest: {input.hlsManifestUrl || 'N/A'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Selected Input Details & Player */}
      {selectedInput && (
        <section style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
          <h2>Selected Input Details</h2>
          <p><strong>Name:</strong> {selectedInput.name}</p>
          <p><strong>UID:</strong> {selectedInput.uid}</p>
          <p><strong>Status:</strong> {selectedInput.connected ? '🟢 Connected' : '⚪ Idle'}</p>
          <p><strong>Playback URL:</strong> {selectedInput.playbackUrl}</p>
          <p><strong>HLS Manifest:</strong> {selectedInput.hlsManifestUrl}</p>

          {selectedInput.hlsManifestUrl && (
            <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
              <h3>HLS Player Test</h3>
              <p style={{ fontSize: '12px', color: '#666' }}>🎬 Testing playback of {selectedInput.hlsManifestUrl}</p>
              <video
                width="100%"
                height="auto"
                controls
                style={{ marginTop: '10px', backgroundColor: '#000' }}
              >
                <source src={selectedInput.hlsManifestUrl} type="application/x-mpegURL" />
                Your browser does not support the video tag.
              </video>
              <p style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
                ℹ️ If no video appears: stream is not currently active, or credentials need refresh.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Create Test Input Button */}
      {liveInputs.length === 0 && (
        <section style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#fffbea', borderRadius: '4px' }}>
          <h2>Create Test Live Input</h2>
          <p>No live inputs exist. Create one to test:</p>
          <button
            onClick={createTestInput}
            disabled={creating || !config?.customerCodeConfigured}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: '#5cb85c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating || !config?.customerCodeConfigured ? 0.6 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create test Live Input'}
          </button>
          {!config?.customerCodeConfigured && (
            <p style={{ color: '#d9534f', marginTop: '10px' }}>
              ⚠️ Cannot create: Cloudflare secrets not configured on server
            </p>
          )}
        </section>
      )}

      {/* Usage Instructions */}
      <section style={{ marginTop: '40px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
        <h2>How to Get RTMPS URL & Stream Key</h2>
        <ol>
          <li>Go to <strong>Cloudflare Dashboard</strong> → <strong>Stream</strong> → <strong>Live Inputs</strong></li>
          <li>Click the live input name</li>
          <li>Copy <strong>RTMPS Server URL</strong> (e.g., <code>rtmps://live.cloudflarestream.com:443/live/</code>)</li>
          <li>Copy <strong>Stream Key</strong> (long alphanumeric code)</li>
          <li>In OBS/FFmpeg: <code>Server: [RTMPS URL]</code>, <code>Stream Key: [key]</code></li>
          <li>Start streaming → Cloudflare webhook notifies Vuvio → Playback URL activates</li>
        </ol>
      </section>

      <section style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fce4ec', borderRadius: '4px' }}>
        <h2>How to Confirm Stream Arrives</h2>
        <ol>
          <li>Start broadcasting in OBS/FFmpeg with RTMPS credentials</li>
          <li>Check this page: selected input should show <strong>🟢 Connected</strong></li>
          <li>HLS Manifest URL should start serving video within 10-30 seconds</li>
          <li>Click "Selected Input Details" and test the HLS Player</li>
          <li>Check Cloudflare Dashboard Live Inputs: viewer count should increment</li>
          <li>In Vuvio Firestore: stream doc `status` changes `connecting` → `live`</li>
        </ol>
      </section>
    </div>
  );
}
