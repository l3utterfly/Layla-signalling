const express = require("express");
const NodeCache = require("node-cache");

const app = express();
const cache = new NodeCache();

app.use(express.json());

// POST /rtc/get-answer
app.post("/rtc/get-answer", (req, res) => {
  const { secret } = req.body;
  const entry = cache.get(`rtc-answers-${secret}`);

  if (!entry) {
    return res.status(404).json({ error: "No answers found for the provided secret." });
  }

  cache.del(`rtc-answers-${secret}`); // clear after retrieval
  res.json(entry);
});

// POST /rtc/submit-answer
app.post("/rtc/submit-answer", (req, res) => {
  const answer = req.body;
  cache.set(`rtc-answers-${answer.secret}`, answer, 60); // 60s = 1 min TTL
  res.sendStatus(200);
});

// POST /rtc/submit-offer
app.post("/rtc/submit-offer", (req, res) => {
  const offer = req.body;
  cache.set(`rtc-offers-${offer.secret}`, offer, 300); // 300s = 5 min TTL
  res.sendStatus(200);
});

// POST /rtc/get-offer
app.post("/rtc/get-offer", (req, res) => {
  const { secret } = req.body;
  const entry = cache.get(`rtc-offers-${secret}`);

  if (!entry) {
    return res.status(404).json({ error: "No offer found for the provided secret." });
  }

  res.json(entry);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));