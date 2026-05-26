const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 5000;

const DATA_FILE = path.join(__dirname, "data.json");

const DEFAULT_DATA = {
  setup: {
    salary: 0,
    savingsPercent: 20,
    emiAmount: 0
  },
  categories: ["Food", "Study", "EMI", "Transport", "Health", "Entertainment", "Others"],
  transactions: []
};

app.use(express.json());

app.use(cors({
  origin: "https://track-record-three.vercel.app"
}));

function normalizeData(data = {}) {
  return {
    setup: {
      ...DEFAULT_DATA.setup,
      ...(data.setup || {})
    },
    categories: Array.isArray(data.categories) && data.categories.length
      ? Array.from(new Set([...DEFAULT_DATA.categories, ...data.categories]))
      : [...DEFAULT_DATA.categories],
    transactions: Array.isArray(data.transactions) ? data.transactions : []
  };
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return normalizeData(DEFAULT_DATA);
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return normalizeData(JSON.parse(raw));
  } catch {
    return normalizeData(DEFAULT_DATA);
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalizeData(data), null, 2));
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/api/data", (req, res) => {
  res.json(readData());
});

app.post("/api/setup", (req, res) => {
  const data = readData();

  data.setup.salary = Number(req.body.salary) || 0;
  data.setup.savingsPercent = Number(req.body.savingsPercent) || 20;
  data.setup.emiAmount = Number(req.body.emiAmount) || 0;

  writeData(data);
  res.json({ success: true });
});

app.post("/api/transaction", (req, res) => {
  const data = readData();

  const title = String(req.body.title || "").trim();
  const amount = Number(req.body.amount) || 0;
  const type = req.body.type === "income" ? "income" : "expense";
  const category = String(req.body.category || "Others").trim() || "Others";
  const date = req.body.date || new Date().toISOString().slice(0, 10);

  if (!title || !amount) {
    return res.status(400).json({ success: false, message: "Title and amount are required" });
  }

  if (!data.categories.includes(category)) {
    data.categories.push(category);
  }

  data.transactions.unshift({
    id: Date.now(),
    title,
    amount,
    type,
    category,
    date
  });

  writeData(data);
  res.json({ success: true });
});

app.delete("/api/transaction/:id", (req, res) => {
  const data = readData();
  data.transactions = data.transactions.filter(t => String(t.id) !== String(req.params.id));
  writeData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});