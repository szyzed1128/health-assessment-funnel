const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const answers = {
  gender: "female",
  goal: "lose_weight",
  age: 32,
  heightCm: 168,
  currentWeightKg: 75,
  targetWeightKg: 65,
  exerciseFrequency: "one_to_two_times_weekly",
};

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`${response.status} ${payload.error?.code ?? "UNKNOWN_ERROR"}`);
  }

  return payload.data;
}

const session = await request("/api/sessions", { method: "POST" });
for (const [questionKey, value] of Object.entries(answers)) {
  await request(`/api/sessions/${session.sessionId}/answers/${questionKey}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

await request(`/api/sessions/${session.sessionId}/assessment`, { method: "POST" });
await request("/api/pay", {
  method: "POST",
  body: JSON.stringify({ sessionId: session.sessionId, paymentEventId: crypto.randomUUID() }),
});

console.log(`Paid demo sessionId: ${session.sessionId}`);
console.log(`Member result: ${baseUrl}/api/sessions/${session.sessionId}/result`);
