# Phase 3 Workshop / Together — WIP tracker

> Session started 2026-11-17. Checkpoint doc so work can resume across context limits.
> Full original brief: `.claude/projects/-Users-alexandreranson-Desktop-vuvio/memory/project_workshop_phase3_brief.md`

## Progress

| Section | Status | Output |
|---|---|---|
| 1. Audit existing architecture | ✅ done | AUDIT_EXISTING_ARCHITECTURE.md |
| 2. Research CF Stream / CF Realtime / LiveKit | ✅ done | RESEARCH_INFRA_OPTIONS.md |
| 3. ARCHITECTURE_COMPARISON.md | ✅ done | 12-criteria table + 3 scenarios → **Recommendation: Hybrid (CF Stream + CF Realtime)** |
| 4. WORKSHOP_TOGETHER_ARCHITECTURE.md | ✅ done | Firestore schema, CF Realtime Functions, Spotlight consent flow, Migration strategy |
| 5. WORKSHOP_SECURITY_AUDIT.md | ✅ done | 5 findings + hardened rules, Emulator tests, acceptance criteria |
| 6. IMPLEMENTATION_ROADMAP.md | ✅ done | 6-week phased rollout, 42 person-days, $260k Year 1 investment, go/no-go gates |

## STATUS: PHASE 3 COMPLETE ✅ — PHASE 4 IN PROGRESS 🏗️

**Phase 3 (Design):** 6 deliverables complete (2026-11-17)  
**Phase 4 (PoC):** Implementation started (2026-11-17)

### Phase 4 Progress

| Component | Status | Notes |
|-----------|--------|-------|
| `/admin/realtime-test` frontend | ✅ done | AdminRealtimeTestPage.jsx (344 lines) + CSS (307 lines) |
| Firebase Function (token generation) | ✅ done | generateCFRealtimeToken.ts (110 lines) |
| Route integration | ✅ done | Added to App.jsx + AdminRoute protection |
| Documentation (REALTIME_POC.md) | ✅ done | Setup instructions + test protocol + cost analysis |
| CF Realtime pricing verification | ✅ done | SFU $0.05/GB (not RealtimeKit), 1 GB free tier |
| **Status** | ⏳ pending | Manual testing required (see test protocol) |

### Setup Required

1. **Cloudflare Realtime API credentials**
   - Account ID + API Token (generate in Dashboard)
   - Set in Firebase env: `CF_API_TOKEN`, `CF_ACCOUNT_ID`

2. **Firebase Function deployment**
   ```bash
   firebase deploy --only functions:generateCFRealtimeToken
   ```

3. **Firestore rules update** (rtcSessions collection)

4. **Local test** (2 devices)
   ```bash
   npm run dev
   # Open http://localhost:5173/admin/realtime-test on both devices
   ```

### Cost Findings (Actual 2026 Rates)

- SFU raw: $0.05/GB egress, 1 GB free/month ✅
- RealtimeKit: $0.002/min (NOT needed for PoC)
- PoC 1 hour (2 people): 450 MB = FREE
- 100 sessions/month: ~315 GB = $15.75 (or free month 1)

## Research Findings Summary

### Infrastructure Options (2026 Pricing)

**Option A: Cloudflare Stream (Current)**
- $1/1k min delivery (HLS/WHEP)
- <500ms latency, 1-to-many only
- ❌ Not suitable for multi-participant

**Option B: Cloudflare Realtime (SFU)**
- $0.002/min per video participant (RealtimeKit layer)
- $0.05/GB egress (first 1GB free)
- ✅ Multi-participant capable, managed SFU

**Option C: LiveKit Cloud**
- $0.016/min per video participant
- Self-hosted option available (free OSS)
- ✅ Multi-participant, more flexible

**Recommendation:** Hybrid
1. Keep CF Stream for public broadcast (Workshop public arm)
2. Use CF Realtime SFU for participants + Spotlight (cheapest managed multi-participant)
3. Consider LiveKit self-hosted if scale grows (break-even ~100 hrs/month)

**Cost for Scenario 1 (5-participant workshop, 60 min):**
- CF Stream alone: $0.05
- CF Realtime hybrid: $0.72
- LiveKit Cloud: $5.88
- LiveKit Self: $60–100/mo fixed

## Constraints (reminder)
- No deploy
- Do not modify `firestore.rules` on prod
- Do not replace Cloudflare Stream (extend it via hybrid architecture)
- Do not disturb classic Lives (new Workshop/Together runs in parallel)
- Preserve Playground
- No major dep without justification
- Verify every claim against official docs — ✅ ALL SOURCES CITED
</content>
