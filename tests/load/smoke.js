// Smoke: does the script work and does the system respond under minimal load?
// Run this first, every time.   k6 run -e TARGET_URL=http://localhost:3000 tests/load/smoke.js
import { THRESHOLDS, journey } from "./lib/scenario.js";

export const options = {
  vus: 2,
  duration: "1m",
  thresholds: THRESHOLDS,
};

export default journey;
