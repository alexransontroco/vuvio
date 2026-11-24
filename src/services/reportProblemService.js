export function prepareProblemReportEmail(payload) {
  if (!payload.subject?.trim() || !payload.description?.trim() || !payload.email?.trim()) {
    throw new Error('Required fields are incomplete.');
  }

  const details = [
    `Category: ${payload.category}`,
    `Contact: ${payload.email.trim()}`,
    '',
    payload.description.trim(),
    payload.steps?.trim() ? `\nSteps to reproduce:\n${payload.steps.trim()}` : '',
    payload.attachTechnicalInfo ? `\nPage: ${window.location.href}\nDevice: ${navigator.userAgent}` : '',
  ].filter(Boolean).join('\n');

  return `mailto:hello@vuvio.app?subject=${encodeURIComponent(`[Vuvio] ${payload.subject.trim()}`)}&body=${encodeURIComponent(details)}`;
}
