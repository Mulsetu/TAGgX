// Soak: normal load for hours, to surface memory leaks, connection exhaustion
// and slow degradation. Watch server memory and DB connections while it runs.
//   k6 run -e TARGET_URL=... -e TARGET_VUS=50 -e SOAK_DURATION=4h tests/load/soak.js
import { THRESHOLDS, journey } from "./lib/scenario.js";

const target = Number(__ENV.TARGET_VUS || 50);

export const options = {
  stages: [
    { duration: "5m", target },
    { duration: __ENV.SOAK_DURATION || "4h", target },
    { duration: "5m", target: 0 },
  ],
  thresholds: THRESHOLDS,
};

export default journey;
