const test = require("node:test");
const assert = require("node:assert/strict");
const LocationController = require("../controller/LocationController");

function responseRecorder() {
  return { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
}

test("reverse returns a readable address", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ address: { suburb: "Sector 38", city: "Gurugram", state: "Haryana", postcode: "122001" } }) });
  try {
    const res = responseRecorder();
    await LocationController.reverse({ query: { lat: "28.4595", lon: "77.0266" }, headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.data.label, "Sector 38, Gurugram, Haryana, 122001");
  } finally { global.fetch = originalFetch; }
});

test("reverse rejects invalid coordinates", async () => {
  const res = responseRecorder();
  await LocationController.reverse({ query: { lat: "200", lon: "77" }, headers: {} }, res);
  assert.equal(res.statusCode, 400);
});
