const express = require("express");
const NodeCache = require("node-cache");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const pollLimiter = rateLimit({
  windowMs: 1000,
  max: 3,
  message: { error: "Too many requests." },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();
const cache = new NodeCache();

app.use(express.json());
app.set("trust proxy", 1);

function sdpFingerprint(sdp) {
  return crypto.createHash("sha256").update(sdp).digest("hex").slice(0, 16);
}

// POST /rtc/get-answer
app.post("/rtc/get-answer", pollLimiter, (req, res) => {
  const { secret, offer } = req.body;
  if (!secret || !offer) {
    return res.status(400).json({ error: "Missing secret or offer." });
  }

  const offerFp = sdpFingerprint(offer);

  // Publish/refresh the offer
  cache.set(`rtc-offer-${secret}`, { payload: offer, offerFp }, 300);

  // Lookup answer keyed to THIS specific offer
  const entry = cache.get(`rtc-answer-${secret}-${offerFp}`);
  if (!entry) {
    return res.status(404).json({ error: "No matching answer yet." });
  }

  cache.del(`rtc-answer-${secret}-${offerFp}`);
  res.json(entry);
});

// POST /rtc/get-offer
app.post("/rtc/get-offer", pollLimiter, (req, res) => {
  const { secret } = req.body;
  if (!secret) {
    return res.status(400).json({ error: "Missing secret." });
  }

  const entry = cache.get(`rtc-offer-${secret}`);
  if (!entry) {
    return res.status(404).json({ error: "No offer found." });
  }

  res.json(entry);
});

// POST /rtc/submit-answer
app.post("/rtc/submit-answer", pollLimiter, (req, res) => {
  const { secret, payload, offer } = req.body;
  if (!secret || !payload || !offer) {
    return res.status(400).json({ error: "Missing secret, payload, or offer." });
  }

  const offerFp = sdpFingerprint(offer);

  // Verify the offer this answer targets is still current
  const currentOffer = cache.get(`rtc-offer-${secret}`);
  if (!currentOffer || currentOffer.offerFp !== offerFp) {
    return res.status(409).json({ error: "Offer has changed. Re-fetch and retry." });
  }

  cache.set(`rtc-answer-${secret}-${offerFp}`, { secret, payload }, 60);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));