# Phase 3 Section 6: Implementation Roadmap & Phased Rollout

**Session:** 2026-11-17 · **Status:** FINAL — Ready for execution

---

## EXECUTIVE SUMMARY

**What:** Implement Workshop (1 creator + 5–10 participants + public spotlight) + Together (4 friends private calls)

**How:** Hybrid CF Stream (broadcast) + CF Realtime (SFU participants)

**Timeline:** 6–8 weeks from approval (dev + testing + staged rollout)

**Cost:** $10k/year infrastructure at 100 sessions/month volume

**Risk:** Low (feature flag, staging validation, gradual creator rollout)

---

## PHASE BREAKDOWN

### **PHASE A: Infrastructure & Backend (Weeks 1–2)**

**Goals:**
1. Deploy Firestore schema extension
2. Implement Firebase Functions for multi-participant
3. CF Realtime integration ready for testing
4. Security rules validated on Emulator

#### **A1: Firestore Schema Deployment** (3 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Write schema migration script | Backend | 1 day | None |
| Deploy hardened Firestore rules | Backend | 1 day | A1 schema |
| Run Emulator security tests | QA | 1 day | A1 rules |
| Staging validation | QA | 0.5 day | A1 tests |

**Output:** `firestore.rules` v2 deployed to staging

**Validation Checklist:**
- [ ] All 19 existing tests pass (backward compatibility)
- [ ] All 10 new security tests pass (mutual consent)
- [ ] No rule syntax errors
- [ ] Staging Firestore accepts new subcollections

---

#### **A2: Firebase Functions** (5 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Implement `createMultiParticipantSession()` | Backend | 2 days | None |
| Implement `generateParticipantToken()` | Backend | 2 days | A2 functions |
| Implement `respondToJoinRequest()` | Backend | 1 day | A2 functions |
| Integration tests | QA | 1 day | A2 functions |

**Output:** 3 Firebase Functions deployed to staging

**Validation Checklist:**
- [ ] CF Realtime room creation succeeds
- [ ] Tokens are ephemeral (1 hr expiry)
- [ ] Join requests are logged to Firestore
- [ ] Error handling for duplicate joins, invalid room IDs

---

#### **A3: CF Realtime Connection Testing** (3 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Spin up CF Realtime test room (staging) | Infra | 1 day | None |
| Test participant token generation | QA | 1 day | A2 functions |
| Test SFU media routing (2 participants) | QA | 1 day | A3 room |

**Output:** Confirmed participant ↔ SFU audio/video works

**Validation Checklist:**
- [ ] Participant A can hear Participant B through SFU
- [ ] Video stream routing works (simulcast 4 tracks)
- [ ] Connection handles network jitter (simulate poor network)
- [ ] Reconnection after disconnect (5 sec timeout)

---

**Phase A Exit Criteria:**
- Firestore schema supports multi-participant (backward compatible)
- Firebase Functions work with real CF Realtime
- Security tests pass on Emulator
- 2-participant SFU test successful

**Timeline:** Weeks 1–2 (10 work days)

---

### **PHASE B: Client-Side Integration (Weeks 2–3)**

**Goals:**
1. Build multi-participant service (replace mock)
2. Implement Spotlight consent flow UI
3. Workshop UI on StudioPage + WatchPage
4. E2E tests with real CF Realtime

#### **B1: `rtcMultiParticipantService.js`** (5 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Implement core service (join, leave, spotlight) | Frontend | 3 days | A2, A3 |
| Implement Spotlight state machine | Frontend | 1 day | B1 service |
| Test with real CF Realtime room | QA | 1 day | B1 service |

**Output:** Service replaces `workshopService.mock.js` for real SFU calls

**Validation Checklist:**
- [ ] `joinAsParticipant()` connects to CF Realtime
- [ ] `requestSpotlight()` sends Firestore mutation
- [ ] `acceptSpotlight()` updates `publicSpotlightAuthorized`
- [ ] `endSpotlight()` stops sending track to broadcast

---

#### **B2: Workshop UI Components** (5 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Update `StudioPage.jsx` with participant roster | Frontend | 2 days | B1 service |
| Update `WatchPage.jsx` with join button | Frontend | 1 day | B1 service |
| Spotlight consent sheets | Frontend | 1 day | B1 service |
| Test on mobile + desktop | QA | 1 day | B2 UI |

**Output:** UI reflects real multi-participant state from Firestore

**Validation Checklist:**
- [ ] Host sees pending join requests
- [ ] Host can approve/decline joins
- [ ] Participant receives spotlight consent prompt
- [ ] Participant can revoke spotlight (UI + Firestore mutation)
- [ ] Public viewers see composed broadcast on revocation

---

#### **B3: Together Mode UI** (3 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Create "Start Together" flow in BottomNav | Frontend | 2 days | B1 service |
| Friend selection + invite UI | Frontend | 1 day | B3 flow |

**Output:** Together UX skeleton (feature flag locked)

**Validation Checklist:**
- [ ] Can select 2–4 friends
- [ ] Invites sent via Firestore (push notifications)
- [ ] Friend can accept invite → join SFU room
- [ ] 4-way audio/video works

---

**Phase B Exit Criteria:**
- Real multi-participant service works with CF Realtime
- Workshop UI reflects Firestore state changes
- Together UX flow complete (behind feature flag)
- Mobile + desktop tested

**Timeline:** Weeks 2–3 (10 work days)

---

### **PHASE C: Testing & Validation (Week 4)**

**Goals:**
1. Security audit with real traffic
2. Performance testing (latency, bitrate)
3. Edge cases (reconnection, network loss)
4. Staging → production validation

#### **C1: Security Testing** (3 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Penetration test: participant self-approval | QA | 1 day | B1, B2 |
| Penetration test: host unilateral spotlight | QA | 1 day | B1, B2 |
| Run full Emulator test suite | QA | 0.5 day | A1 rules |
| Firestore audit: rules enforcement | Backend | 0.5 day | A1 rules |

**Output:** Security findings documented, mitigations confirmed

**Validation Checklist:**
- [ ] All penetration tests fail (as expected — security working)
- [ ] Firestore rules reject invalid mutations
- [ ] Audit trail complete (Firestore timestamps)

---

#### **C2: Performance Testing** (3 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Latency test: participant → SFU → broadcast | QA | 1 day | B1 |
| Bitrate scaling test: poor network (2G) | QA | 1 day | B1 |
| Concurrent load test: 10 workshops simultaneously | QA | 1 day | B1 |

**Output:** Performance baseline documented

**Expected Results:**
- Participant-to-broadcast latency: 200–500ms (acceptable)
- Bitrate at 2G: scales to 300 kbps video + 50 kbps audio (acceptable)
- 10 concurrent workshops: Cloudflare SFU scales automatically

**Validation Checklist:**
- [ ] Latency within SLA (<1 sec public, <300 ms participant-to-participant)
- [ ] Bitrate adaptation works (scales down gracefully)
- [ ] CF Realtime quota not exceeded

---

#### **C3: Staging Deployment** (2 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Deploy all code to staging Firestore + staging CF Realtime | DevOps | 1 day | C1, C2 |
| Run full E2E test suite (Playwright) | QA | 1 day | C3 deploy |

**Output:** Everything staging-ready for production deployment

**Validation Checklist:**
- [ ] All 50 E2E tests pass on staging
- [ ] No data corruption or orphan Firestore docs
- [ ] CF Realtime room cleanup works (rooms don't persist after session ends)

---

**Phase C Exit Criteria:**
- Security audit complete, no showstoppers
- Performance baseline established
- Staging environment fully tested
- Ready for production rollout

**Timeline:** Week 4 (5 work days)

---

### **PHASE D: Production Rollout (Weeks 5–6)**

**Goals:**
1. Gradual creator rollout (whitelist → 10% → 100%)
2. Monitoring & incident response
3. Creator feedback loop
4. Bug fixes from real traffic

#### **D1: Admin Whitelist Rollout** (3 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Enable feature flag for 5 internal creators (staff) | DevOps | 1 day | C3 |
| Monitor Firestore + CF Realtime metrics | Ops | 2 days | D1 flag |

**Creators:** Alex, Doug, Cecilia, 2 trusted beta testers

**Validation Checklist:**
- [ ] No firestore rule violations
- [ ] CF Realtime tokens generate correctly
- [ ] Spotlight flow works end-to-end
- [ ] Creator reports: "feature works as expected"

---

#### **D2: Staged Creator Rollout** (5 days)

**Rollout Plan:**

```
Day 1–2:  10% random creators (500 creators if 5000 active)
Day 3–4:  50% creators
Day 5+:   100% creators (or rollback if critical bugs)
```

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Enable feature flag for 10% cohort | DevOps | 1 day | D1 |
| Monitor errors, metrics, creator feedback | Ops | 2 days | D2 rollout |
| Fix bugs found during 10% rollout | Backend | 2 days | D2 rollout |
| Enable 50% cohort | DevOps | 1 day | D2 bugs fixed |
| Repeat: fix bugs, increase cohort | Backend + Ops | 2 days | D2 bugs fixed |

**Output:** 100% creator rollout

**Validation Checklist:**
- [ ] <1% error rate (Firestore rule violations, CF Realtime connection failures)
- [ ] <100ms latency for participant → SFU routing
- [ ] Creator feedback positive (no "feature is broken" reports)
- [ ] No cascade failures (if one room crashes, others unaffected)

---

#### **D3: Documentation & Knowledge Transfer** (2 days)

| Task | Owner | Effort | Blockers |
|------|-------|--------|----------|
| Write creator docs: "Start a Workshop" | Product | 1 day | D2 rollout |
| Write ops runbook: troubleshoot Workshop issues | Ops | 1 day | D2 rollout |
| Create FAQ: consent, revocation, troubleshooting | Product | 0.5 day | D2 rollout |
| Train support team on Workshop | Ops | 0.5 day | D3 docs |

**Output:** Public documentation + internal runbook

---

**Phase D Exit Criteria:**
- Feature flag enabled for 100% of creators (gradual rollout complete)
- <1% error rate, <100ms latency
- Creator feedback positive
- Ops team can troubleshoot issues

**Timeline:** Weeks 5–6 (10 work days)

---

### **PHASE E: Hardening & Future Work (Week 7+)**

**Optional enhancements (not MVP):**

1. **Spotlight Composition Agent** (Server-side video mixing)
   - Effort: 5 days
   - Benefit: Host can close StudioPage during Spotlight (currently must keep it open)
   - Cost: +$0.001/min (negligible)

2. **Screen-Locked Audio-Only** (PWA + Audio API)
   - Effort: 3 days
   - Benefit: Participant can keep phone locked during Together (save battery)
   - Cost: PWA-specific, no additional infrastructure

3. **End-to-End Encryption** (Client-side encryption + server-side media transformation)
   - Effort: 15+ days
   - Benefit: SFU cannot observe participant media
   - Cost: Complexity ↑↑, latency +100ms
   - **Recommendation:** Skip MVP, evaluate customer demand

4. **LiveKit Self-Hosted Evaluation** (If volume grows)
   - Effort: 10 days (ops setup + testing)
   - Benefit: Save $5k+/year at >100 sessions/month
   - **Trigger:** Monitor session volume; evaluate if growth 2–3x

---

## DEPENDENCY GRAPH

```
A1: Firestore Schema ──→ A2: Firebase Functions ──→ A3: CF Realtime Testing
                                   ↓                          ↓
                                   └──────→ B1: Multi-Participant Service
                                            ↓
                                   B2: Workshop UI ←──┘
                                            ↓
                                   B3: Together UI
                                            ↓
                                            ├──→ C1: Security Testing
                                            ├──→ C2: Performance Testing
                                            └──→ C3: Staging Deployment
                                                    ↓
                                        D1: Admin Rollout
                                            ↓
                                        D2: Staged Rollout (10% → 50% → 100%)
                                            ↓
                                        D3: Documentation
                                            ↓
                                        E: Hardening (optional, future)
```

**Critical Path:** A1 → A2 → B1 → B2 → C1 → C2 → C3 → D (10 weeks, can parallelize A1+B2 after day 3)

**Optimization:** Parallelize A2 + B1 after day 2 (Firestore schema stable)

---

## EFFORT & TIMELINE SUMMARY

| Phase | Effort | Timeline | Owners |
|-------|--------|----------|--------|
| A: Backend + Infra | 11 days | Weeks 1–2 | Backend (4), QA (2) |
| B: Client-Side | 13 days | Weeks 2–3 | Frontend (5), QA (2) |
| C: Testing | 8 days | Week 4 | QA (3), Backend (1), Ops (2) |
| D: Rollout | 10 days | Weeks 5–6 | DevOps (2), Ops (3), Backend (2) |
| **Total** | **42 days** | **6 weeks** | **Team of 6–8** |

**Can compress to 4–5 weeks with 8-person team + parallel work in A/B**

---

## COST FORECAST (12-Month Horizon)

### **Infrastructure Costs**

| Service | Usage | Cost/Month | Annual |
|---------|-------|-----------|--------|
| **CF Stream** (broadcast) | 100 hrs/month × 50 avg viewers | $60 | $720 |
| **CF Realtime** (SFU) | 100 hrs/month × 7 avg participants | $840 | $10,080 |
| **Firebase (Firestore + Functions)** | 100k reads/month, 10k writes | $100 | $1,200 |
| **Logging + Monitoring** (Stackdriver) | 1 TB/month logs | $50 | $600 |
| **Storage (R2 recordings, optional)** | 50 TB/month | $250 | $3,000 |
| **Total Infrastructure** | — | **$1,300** | **$15,600** |

**Note:** Assumes 100 sessions/month, 1 hour avg per session, 50 public viewers + 7 participants average

### **Operational Costs (Team)**

| Role | Headcount | Salary/Month | Annual |
|------|-----------|-------------|--------|
| Backend (Firebase Functions, CF Realtime) | 1 | $6,000 | $72,000 |
| Frontend (React, WebRTC client) | 1 | $6,000 | $72,000 |
| DevOps / Infra | 0.5 | $3,000 | $36,000 |
| QA / Testing | 0.5 | $3,000 | $36,000 |
| **Total Ops (Year 1)** | — | **$18,000** | **$216,000** |

**Note:** Year 1 includes development + first 6 months of support. Year 2 drops to 0.25 FTE for maintenance.

### **Total Cost of Ownership (Year 1)**

```
Infrastructure:    $15,600
Team:              $216,000
Marketing (optional):  $5,000
Contingency (10%):  $23,660
─────────────────────────
TOTAL (Year 1):   $260,260
```

**Cost per Session (100 sessions/month average):**
- Infrastructure: $13/session
- Team: $180/session (amortized)
- **Total: $193/session**

**Break-Even:** Assuming $20/session creator revenue (10% cut), need 10 sessions/month to break even.

---

## RISK MITIGATION & CONTINGENCY

### **Risk 1: CF Realtime Quota Exceeded**

**Probability:** Low (Cloudflare auto-scales)  
**Impact:** High (Workshop sessions fail)  
**Mitigation:**
- Monitor CF Realtime metrics weekly
- Alert if >80% quota usage
- Contact Cloudflare to increase quota
- Contingency: Fallback to LiveKit Cloud (1-day migration, cost +$5k/year)

---

### **Risk 2: Firestore Security Rule Regression**

**Probability:** Medium (humans write rules)  
**Impact:** High (participant self-approval vulnerability)  
**Mitigation:**
- All rule changes reviewed by 2 people
- 100% Emulator test coverage before prod deployment
- Staged rollout (10% creators first) catches issues early

---

### **Risk 3: Creator Churn (Feature Flops)**

**Probability:** Medium (new features have adoption curve)  
**Impact:** Medium (infrastructure costs continue, revenue doesn't)  
**Mitigation:**
- Creator onboarding flow (tutorial, success metrics)
- Early feedback loop (email survey after first Workshop)
- Contingency: Disable feature if <5% adoption after 2 months, redeploy team

---

### **Risk 4: Mobile Network Reconnection Fails**

**Probability:** Medium (mobile networks are flaky)  
**Impact:** Medium (participant drops from Workshop mid-session)  
**Mitigation:**
- SFU auto-reconnect on timeout (CF Realtime handles)
- Document in FAQ: "if you drop, rejoin — your approval persists"
- Future: Persistent session keys (Phase 3.5)

---

## GO/NO-GO DECISION GATES

**Gate 1 (End of Phase C):** "Is security validated?"
- Criteria: All penetration tests fail (security working), Firestore rules pass, latency <1s
- **Go:** Yes → proceed to D
- **No-Go:** Delay 2 weeks, fix security findings

**Gate 2 (End of Phase D1):** "Is the feature stable with internal creators?"
- Criteria: <1% error rate, creator feedback positive, no crashes
- **Go:** Yes → enable 10% rollout
- **No-Go:** Rollback, fix bugs, re-test with 5 internal creators

**Gate 3 (End of Phase D2 10% cohort):** "Is the feature ready for 100%?"
- Criteria: <1% error rate continues, creator retention high (>80%), no escalations
- **Go:** Yes → scale to 50%, then 100%
- **No-Go:** Rollback to whitelist, disable feature flag, re-evaluate

---

## LAUNCH CHECKLIST (Pre-Production)

### **Code Readiness**
- [ ] All code reviewed + merged to main
- [ ] No warnings in Firestore rules validation
- [ ] All Emulator tests pass (100% green)
- [ ] No console.error or unhandled Promise rejections

### **Infra Readiness**
- [ ] CF Realtime production room created + tested
- [ ] Firestore rules deployed to prod
- [ ] Firebase Functions deployed (staging-proven)
- [ ] Monitoring alerts configured (Firestore errors, CF Realtime quota, latency)

### **Documentation**
- [ ] Creator docs published (Workshop + Together)
- [ ] Ops runbook written + team trained
- [ ] FAQ published (FAQs about consent, revocation, troubleshooting)
- [ ] Release notes ready

### **Team Readiness**
- [ ] Support team trained on troubleshooting
- [ ] On-call rotation established (ops, backend)
- [ ] Communication plan for outages (Slack channel)
- [ ] Rollback plan written + tested

### **Approval**
- [ ] Product: Feature approved for rollout
- [ ] Legal: Consent flow reviewed (no legal risks)
- [ ] Exec: Budget approved for infrastructure costs
- [ ] QA: All test suites pass

---

## SUCCESS METRICS (Post-Launch)

### **Technical**

- **Availability:** >99.9% uptime (target: <100 min/month downtime)
- **Latency:** P95 latency <300ms (SFU participant-to-participant)
- **Error Rate:** <0.5% Workshop session failures
- **Scaling:** Auto-scales to 500 concurrent participants (Cloudflare managed)

### **Product**

- **Adoption:** >5% of creators enable Workshop within 30 days
- **Retention:** >70% of creators who try Workshop do it again within 60 days
- **Engagement:** Average 10 participants per Workshop session (target: 5–15)
- **Safety:** Zero consent violations (audit trail shows dual approval for all Spotlights)

### **Business**

- **Revenue:** Creator revenue from Workshop sessions (if applicable)
- **Cost Efficiency:** Infrastructure cost <$10/session (target: $13/session at 100 sessions/month)
- **User Satisfaction:** Creator NPS >40 for Workshop feature

---

## HANDOFF & MAINTENANCE (Year 2+)

After launch, maintenance:

- **Ops (0.25 FTE):** Monitor metrics, incident response, Cloudflare quota management
- **Backend (0.1 FTE):** Bug fixes, security patches
- **Frontend (0.1 FTE):** UX improvements, mobile fixes

**Annual Budget (Year 2):** Infrastructure $15,600 + Team $60,000 = $75,600 (amortized)

**PoC Path Forward:** If Together gains traction (>20 sessions/month), consider dedicated team for E2E encryption + self-hosted LiveKit evaluation.

---

## FINAL RECOMMENDATION: PROCEED WITH PHASE A

**Approval requested:** 6–8 weeks, 42 person-days, $260k investment (Year 1)

**Expected outcome:** Workshop + Together feature live, 100 creator rollout, monitoring stable

**Next step:** Allocate team, review FIRESTORE_RULES hardening, start Firebase Function development (Phase A2)

---

**All 6 deliverables complete:** ✅ Audit ✅ Research ✅ Comparison ✅ Architecture ✅ Security ✅ Roadmap

**Ready for executive approval & team allocation.**
