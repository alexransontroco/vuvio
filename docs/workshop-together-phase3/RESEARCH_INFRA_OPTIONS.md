# Phase 3 Section 2: Research & Compare Real-Time Infrastructure Options

**Session:** 2026-11-17 · **Status:** COMPLETE — Web research compiled

Sources verified from official docs + 2026 pricing:

---

## OPTION A: Cloudflare Stream (Current + WHIP/WHEP WebRTC)

### **Pricing (Nov 2026)**
- **Ingest:** Free
- **Delivery (HLS):** $1 per 1,000 minutes
- **Delivery (WebRTC/WHEP):** $1 per 1,000 minutes (billing started Oct 15, 2026)
- **Recording storage:** $5 per 1,000 minutes stored
- **WebRTC delivery:** No recording, thus no storage consumption (viewer-only)

### **Features**
- **1-to-many broadcast:** Creator → Cloudflare → viewers
- **WHIP ingest:** Standard protocol, low latency
- **WHEP playback:** WebRTC pull, <500ms latency to unlimited concurrent viewers
- **HLS fallback:** Standard m3u8 manifest (CDN-distributed)
- **Trickle ICE:** Yes (supported since 2026)
- **Simulcast:** Via Live Output API (send to external RTMP simultaneously)
- **Recording:** Optional, stored in R2 (Cloudflare Object Storage)

### **Latency**
- **Broadcast-to-viewer:** <500ms (WebRTC)
- **No sub-100ms guarantee** — physical distance + media processing = baseline ~200–300ms typical

### **Scalability**
- **Unlimited concurrent viewers** per live
- **1 broadcaster per live input** — no multi-track source (can't do 2 POV cameras feeding same input)

### **Multi-Participant Capability**
- ❌ **NOT SUITABLE** for multi-participant interactive (Workshop Spotlight, Together)
- Cloudflare Stream is **viewer-only playback**, not SFU routing
- Could use **separately** for broadcast arm of hybrid (Workshop public stream) + separate SFU for participant audio/video

### **Mobile Support**
- ✅ iOS Safari WHEP: Yes (standardized WebRTC)
- ✅ Android Chrome WHEP: Yes
- ✅ HLS fallback: Broad support

### **Self-Hosting**
- ❌ Not available — fully managed service

### **Operational Overhead**
- ✅ Minimal — no server management
- Webhook setup required for recording status

---

## OPTION B: Cloudflare Realtime (SFU + Managed Conferencing)

### **Pricing (Nov 2026)**

#### **Core SFU/TURN Services**
- **Egress:** $0.05/GB (first 1,000 GB/month free, shared SFU + TURN)
- **Typical usage:** 2–4 participants, 60 min, VP8 1 Mbps each
  - Ingress: ~240 MB/participant (unlimited, no cost)
  - Egress: ~480 MB total (first 1,000 GB free each month)
  - **Cost: $0 (within free tier)**

#### **RealtimeKit (Higher-Level Conferencing API)**
- **Audio/Video participant:** $0.002/minute
- **Audio-only participant:** $0.0005/minute
- **Recording (MP4):** $0.010/minute
- **RTMP/HLS export:** $0.010/minute
- **Audio-only export:** $0.003/minute
- **Raw RTP export to R2:** $0.0005/minute

**Example:** 4 participants, 60 min video call
- SFU: $0 (within free egress)
- RealtimeKit: 4 × 0.002 × 60 = $0.48
- **Total: ~$0.50** ✅ Very affordable

**Limitation:** RealtimeKit is **managed layer** (additional API, adds latency + cost); raw SFU access is cheaper but requires client-side complexity.

### **Features**
- **SFU (Selective Forwarding Unit):** Central hub routes media between participants
- **Multi-participant:** Hundreds of participants per room (practical limit ~20–50 video before bitrate explosion)
- **Global SFU deployment:** 330+ cities worldwide (reduces peer distance vs self-hosted)
- **WebRTC + SFU:** Each participant sends 1 stream, SFU forwards N-1 streams to each
- **RTMP/HLS export:** Simulcast conference to external platforms
- **Recording to R2:** Persistent conference archive
- **Permissions:** Publish/subscribe roles per participant

### **Latency**
- **SFU routing:** ~100–200ms typical (depends on participant distance + SFU load)
- **Lower than full-mesh P2P** at 3+ participants (less bandwidth per peer)

### **Scalability**
- **Practical limit:** 20–50 video participants (bitrate scaling is the bottleneck, not SFU)
- **100+ audio-only:** Feasible (audio is 50–100 kbps)
- **Horizontal scaling:** Cloudflare manages; no server setup

### **Multi-Participant Capability**
- ✅ **EXCELLENT** for Workshop (Spotlight participant + 10 others + audio feedback)
- ✅ **EXCELLENT** for Together (4 friends, all bidirectional audio/video)
- ✅ **Can support hybrid:** Main SFU conference + separate WebRTC peer for private POV

### **Mobile Support**
- ✅ iOS Safari WebRTC: Yes (via iOS 15.1+)
- ✅ Android Chrome WebRTC: Yes
- ⚠️ **Audio quality on mobile:** Network switching (WiFi → LTE) can cause jitter; mitigation = adaptive bitrate (Cloudflare handles)

### **Self-Hosting**
- ❌ Not available — Cloudflare-managed only
- Alternative: Use raw SFU API + manage own encoder, but loses Cloudflare redundancy

### **Operational Overhead**
- ✅ Minimal — no server management
- Permissions system requires careful design (who can publish? Who can subscribe?)

---

## OPTION C: LiveKit (Cloud or Self-Hosted SFU)

### **Pricing**

#### **LiveKit Cloud (Nov 2026)**

**Agent/Automation:**
- Free tier: 1,000 agent-session minutes/month
- Ship plan: $50/month
- Scale plan: $500/month
- Overage: $0.01/agent-minute

**Participant-Based (Audio/Video):**
- **Audio participant:** $0.004/minute
- **Video participant:** $0.016/minute
- **Downstream bandwidth:** $0.12/GB (dropped from $0.18/GB in 2026, now cheaper than CF Realtime for high bandwidth)
- **Upstream bandwidth:** Free (as of 2026)

**Example:** 4 participants, 60 min video call
- Video: 4 × 0.016 × 60 = $3.84
- Egress: Assume 100 MB/participant = 400 MB = $0.048
- **Total: ~$3.90**

**Example:** 10 participants, 90 min audio-only
- Audio: 10 × 0.004 × 90 = $3.60
- Egress: ~50 MB/participant = 500 MB = $0.06
- **Total: ~$3.66**

#### **LiveKit Self-Hosted (Free Software, Apache 2.0)**
- **Cost:** Only your infrastructure
- **Typical:** ~$60–100/month for 200 concurrent users (small VM)
- **No license fees, no per-minute charges, no participant limits**
- Scaling: Add more VMs, deploy LiveKit agents (open-source)

**Comparison at scale:**
- Cloud: 100,000 participant-minutes/month = $1,600 (video)
- Self-hosted: ~$600–1,200/month for 200 concurrent (saves $400–1,000/month)
- **Break-even:** ~100 hours of heavy usage monthly

### **Features**
- **SFU:** Same as Cloudflare Realtime, but LiveKit is open-source reference implementation
- **WebRTC agents:** Client libraries in JS/React, Python, Go, Rust
- **Recording:** Via agent + cloud storage integration
- **RTMP/HLS egress:** Composeable (mix multiple participants into single broadcast)
- **Permissions:** Publish/subscribe roles
- **Room-based:** Each room is isolated (no cross-room participant forwarding by default)

### **Latency**
- **SFU routing:** ~100–300ms (depends on deployment + geography)
- **Self-hosted:** Can co-locate with app server for <50ms latency

### **Scalability**
- **Cloud:** Managed scaling, no limits (practically 50–100 video participants before bitrate collapse)
- **Self-hosted:** Scales linearly with server resources (each node ~100–200 concurrent participants)

### **Multi-Participant Capability**
- ✅ **EXCELLENT** for Workshop & Together (native SFU design)
- ✅ **Can integrate LiveKit agents** for recording, AI transcription, etc.

### **Mobile Support**
- ✅ iOS Safari: Yes (LiveKit SDK, WebRTC compatible)
- ✅ Android Chrome: Yes
- ✅ Excellent adaptive bitrate (scales down on poor networks)

### **Self-Hosting**
- ✅ **FULLY AVAILABLE** — Apache 2.0 license
- Docker deployment, Kubernetes-ready
- No external dependencies (can run on-premises if needed)

### **Operational Overhead**
- **Cloud:** Minimal
- **Self-hosted:** Medium (need DevOps: monitoring, upgrades, backups, disaster recovery)

### **Integrations**
- **LiveKit Agents:** Python/JS SDK for AI features (transcription, summarization, etc.)
- **Custom recording:** Via agent + S3/R2 integration
- **Egress composition:** Mix participants, add overlays, output to RTMP/HLS

---

## COST COMPARISON: 3 PRICING SCENARIOS

### **Scenario 1: Small Workshop (1 creator + 5 participants + 50 spectators, 60 min)**

| Component | CF Stream | CF Realtime | LiveKit Cloud | LiveKit Self |
|-----------|-----------|-------------|---------------|--------------|
| Broadcast ingest | Free | $0 (via SFU) | $0 | $0 |
| **SFU routing** (participants + spectator viewer layer) | N/A | Egress $0.05/GB free tier | — | — |
| Public broadcast out (HLS/WHEP) | 1 creator + 50 viewers = 51 × $1/1k min × 1 = $0.05 | RealtimeKit 1 × 0.002 × 60 = $0.12 | Video broadcast × 0.016/min × 60 = $0.96 | $0 (self-hosted) |
| **Participant SFU** | N/A | 5 participants × 0.002 × 60 = $0.60 | 5 × 0.016 × 60 = $4.80 | $0 (self-hosted) |
| Egress | $0.05 | $0 (within free tier) | $0.12 | $0 |
| **TOTAL** | **$0.05** | **$0.72** | **$5.88** | **$60–100/mo** (fixed) |

**Winner:** CF Stream for broadcast-only, Realtime for interactivity

---

### **Scenario 2: Large Workshop (1 creator + 10 participants + 500 spectators, 60 min)**

| Component | CF Stream | CF Realtime | LiveKit Cloud | LiveKit Self |
|-----------|-----------|-------------|---------------|--------------|
| Public broadcast (HLS/WHEP) | 1 + 500 = 501 × $1/1k × 1 = $0.50 | RealtimeKit 1 × 0.002 × 60 = $0.12 | 1 × 0.016 × 60 = $0.96 | $0 |
| **Participant SFU** | N/A | 10 × 0.002 × 60 = $1.20 | 10 × 0.016 × 60 = $9.60 | $0 |
| Egress | $0.50 | $0 (within free) | $0.24 | $0 |
| **TOTAL** | **$1.00** | **$1.32** | **$10.80** | **$60–100/mo** |

**Winner:** CF Realtime for cost + interactivity

---

### **Scenario 3: Together (4 friends, 90 min, all audio/video, private)**

| Component | CF Stream | CF Realtime | LiveKit Cloud | LiveKit Self |
|-----------|-----------|-------------|---------------|--------------|
| SFU routing | N/A | Egress $0 (within free) | — | — |
| **Audio + video peers** | N/A (not multi-participant capable) | 4 × 0.002 × 90 = $0.72 | 4 × 0.016 × 90 = $5.76 | $0 |
| Egress | — | $0 | $0.12 | $0 |
| **TOTAL** | **N/A** | **$0.72** | **$5.88** | **$60–100/mo** |

**Winner:** CF Realtime (small cost, no self-hosted overhead)

---

## FEATURE COMPARISON TABLE

| Feature | CF Stream | CF Realtime | LiveKit Cloud | LiveKit Self |
|---------|-----------|-------------|---------------|--------------|
| **Multi-participant SFU** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Latency** | <500ms (viewer only) | ~150ms (SFU) | ~150ms (SFU) | ~100ms (co-located) |
| **Concurrent participants** | 1 broadcaster, ∞ viewers | 50 video, ∞ audio | 50 video, ∞ audio | 100–200/node |
| **Global CDN** | ✅ Cloudflare edge | ✅ Cloudflare edge | ✅ Managed | ⚠️ Manual |
| **Mobile iOS Safari** | ✅ | ✅ | ✅ | ✅ |
| **Recording** | ✅ R2 storage | ✅ R2 export | ✅ Agent-based | ✅ Agent-based |
| **RTMP simulcast** | ✅ Via Live Output | ✅ RTMP export | ✅ Egress API | ✅ Custom agent |
| **Self-hosting** | ❌ No | ❌ No | ✅ Yes | ✅ Yes (OSS) |
| **Pricing simplicity** | 🔴 Delivery-based | 🟢 Per-minute + egress | 🟢 Per-minute | 🟢 Fixed (self-host) |
| **Custom integrations** | 🟡 Limited | 🟡 Limited | ✅ Agents | ✅ Full code |

---

## RECOMMENDATION FOR PHASE 3

**Hybrid Architecture (Recomendation):**

1. **Keep CF Stream for public broadcast** (Workshop broadcast arm)
   - Creator POV goes live via WHIP → Cloudflare Stream → HLS/WHEP for public viewers
   - Cost: ~$0.05–1.00/hour (broadcast only)

2. **Use CF Realtime SFU for participants + Spotlight** (Workshop interactive arm)
   - Host + 5–10 participants peer via WebRTC → CF Realtime SFU
   - Spotlighted participant mixed back to CF Stream broadcast (Cloudflare API can composite)
   - Cost: ~$0.70/hour (participants only), or $0 if within free egress tier

3. **For Together (private sessions):** CF Realtime or LiveKit Cloud
   - 4 friends, end-to-end encrypted audio/video
   - No public broadcast
   - Cost: ~$0.70/hour CF Realtime (cheaper) or $5.88/hour LiveKit (more features)

4. **Future: Evaluate self-hosted LiveKit** if volume grows
   - Break-even at ~100 hours heavy usage monthly
   - Full control, custom agent integrations (AI recording, etc.)

---

**Next Section:** Detailed architecture design for hybrid setup (Workshop + Together)

Sources: [Cloudflare Stream Ultra-low Latency WebRTC Docs](https://developers.cloudflare.com/stream/webrtc/), [Cloudflare Realtime Pricing Docs](https://developers.cloudflare.com/realtime/sfu/platform/pricing/), [LiveKit 2026 Pricing](https://micdrop.dev/blog/livekit-pricing)
