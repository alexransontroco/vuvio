export async function submitProblemReport(payload) {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 620);
  });

  if (!payload.subject?.trim() || !payload.description?.trim() || !payload.email?.trim()) {
    throw new Error('Required fields are incomplete.');
  }

  return {
    reference: `VUV-${Math.floor(100000 + Math.random() * 900000)}`,
  };
}
