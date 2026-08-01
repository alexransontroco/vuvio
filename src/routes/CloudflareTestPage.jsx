import { useEffect, useState } from 'react';

const styles = {
  container: {
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    maxWidth: '1000px',
    margin: '0 auto',
    backgroundColor: '#fafafa',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '40px',
    borderBottom: '3px solid #0066cc',
    paddingBottom: '20px',
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '0',
  },
  section: {
    marginBottom: '30px',
    padding: '24px',
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: '0',
    marginBottom: '16px',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  statusItem: {
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    border: '1px solid #e0e0e0',
  },
  statusLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  statusValue: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#1a1a1a',
  },
  inputCard: {
    padding: '16px',
    marginBottom: '12px',
    backgroundColor: '#f9f9f9',
    border: '2px solid #e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  inputCardHovered: {
    backgroundColor: '#e3f2fd',
    borderColor: '#0066cc',
    boxShadow: '0 4px 12px rgba(0,102,204,0.15)',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  errorBox: {
    padding: '16px',
    backgroundColor: '#ffebee',
    border: '1px solid #ef5350',
    borderRadius: '6px',
    color: '#c62828',
    fontSize: '14px',
  },
  infoBox: {
    padding: '16px',
    backgroundColor: '#e3f2fd',
    border: '1px solid #42a5f5',
    borderRadius: '6px',
    color: '#1565c0',
    fontSize: '14px',
  },
};

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

  const API_BASE = 'https://api-4clo52m3sq-ew.a.run.app';

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/cloudflare/config`);
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
      const response = await fetch(`${API_BASE}/api/cloudflare/inputs`);
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
      const response = await fetch(`${API_BASE}/api/cloudflare/create-test-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      alert(`✅ Created: ${data.input.name}\nUID: ${data.input.uid}`);
      await fetchLiveInputs();
    } catch (err) {
      alert(`❌ Creation failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🌐 Cloudflare Stream Diagnostic</h1>
        <p style={styles.subtitle}>Monitor and test your Cloudflare Live Input configuration</p>
      </div>

      {error && <div style={styles.errorBox}>⚠️ {error}</div>}

      {/* Configuration Status */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Configuration Status</h2>
        {config ? (
          <div style={styles.statusGrid}>
            <div style={styles.statusItem}>
              <div style={styles.statusLabel}>Account ID</div>
              <div style={styles.statusValue}>{config.accountIdConfigured ? '✅ Configured' : '❌ Missing'}</div>
            </div>
            <div style={styles.statusItem}>
              <div style={styles.statusLabel}>API Token</div>
              <div style={styles.statusValue}>{config.apiTokenConfigured ? '✅ Configured' : '❌ Missing'}</div>
            </div>
            <div style={styles.statusItem}>
              <div style={styles.statusLabel}>Webhook Secret</div>
              <div style={styles.statusValue}>{config.webhookSecretConfigured ? '✅ Configured' : '❌ Missing'}</div>
            </div>
            <div style={styles.statusItem}>
              <div style={styles.statusLabel}>Customer Code</div>
              <div style={styles.statusValue}>{config.customerCodeConfigured ? '✅ Configured' : '❌ Missing'}</div>
            </div>
          </div>
        ) : (
          <p>Loading configuration...</p>
        )}
      </section>

      {/* Live Inputs */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Live Inputs ({liveInputs.length})</h2>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <div style={styles.errorBox}>⚠️ {error}</div>
        ) : liveInputs.length === 0 ? (
          <div style={styles.infoBox}>ℹ️ No live inputs found. Create one to test.</div>
        ) : (
          <div>
            {liveInputs.map((input) => (
              <div
                key={input.uid}
                onClick={() => setSelectedInput(input)}
                style={{
                  ...styles.inputCard,
                  ...(selectedInput?.uid === input.uid ? styles.inputCardHovered : {}),
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  {input.name}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                  <strong>UID:</strong> {input.uid.substring(0, 16)}...
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  <strong>Status:</strong> {input.connected ? '🟢 Connected' : '⚪ Idle'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Selected Input Details */}
      {selectedInput && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Input Details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <div style={styles.statusLabel}>Name</div>
              <div style={styles.statusValue}>{selectedInput.name}</div>
            </div>
            <div>
              <div style={styles.statusLabel}>Status</div>
              <div style={styles.statusValue}>{selectedInput.connected ? '🟢 Connected' : '⚪ Idle'}</div>
            </div>
            <div>
              <div style={styles.statusLabel}>UID</div>
              <div style={{ ...styles.statusValue, fontSize: '12px', fontFamily: 'monospace' }}>
                {selectedInput.uid}
              </div>
            </div>
            <div>
              <div style={styles.statusLabel}>Playback URL</div>
              <div style={{ ...styles.statusValue, fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {selectedInput.playbackUrl || 'N/A'}
              </div>
            </div>
          </div>

          {selectedInput.hlsManifestUrl && (
            <div style={{ ...styles.infoBox, marginTop: '20px' }}>
              ℹ️ HLS stream is ready at: <code>{selectedInput.hlsManifestUrl}</code>
            </div>
          )}
        </section>
      )}

      {/* Create Test Input */}
      {liveInputs.length === 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Create Test Input</h2>
          <p style={{ marginBottom: '16px' }}>Create a new test live input to verify your Cloudflare configuration.</p>
          <button
            onClick={createTestInput}
            disabled={creating || !config?.customerCodeConfigured}
            style={{
              ...styles.button,
              ...(creating || !config?.customerCodeConfigured ? styles.buttonDisabled : {}),
            }}
          >
            {creating ? '⏳ Creating...' : '➕ Create Test Input'}
          </button>
          {!config?.customerCodeConfigured && (
            <div style={{ ...styles.errorBox, marginTop: '16px' }}>
              ⚠️ Cannot create: Cloudflare secrets not configured on server
            </div>
          )}
        </section>
      )}

      {/* Instructions */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>📚 How to Use</h2>
        <ol style={{ lineHeight: '1.8', color: '#333' }}>
          <li>Go to <strong>Cloudflare Dashboard</strong> → <strong>Stream</strong> → <strong>Live Inputs</strong></li>
          <li>Select a live input and copy the <strong>RTMPS Server URL</strong></li>
          <li>In OBS/FFmpeg, enter the Server URL and Stream Key</li>
          <li>Start streaming — status will change to 🟢 Connected</li>
          <li>The HLS Manifest URL will activate automatically</li>
        </ol>
      </section>
    </div>
  );
}
