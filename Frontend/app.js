const API = "https://track-record.onrender.com/api";

let dashboardChart = null;
let reportSummaryChart = null;
let reportCategoryChart = null;

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

function currentMonthKey() {
  return monthKey(new Date().toISOString());
}

async function fetchData() {
  const res = await fetch(`${API}/data`);
  return await res.json();
}

async function saveSetup() {
  const salary = document.getElementById("salary")?.value || 0;
  const savingsPercent = document.getElementById("savings")?.value || 20;
  const emiAmount = document.getElementById("emi")?.value || 0;

  await fetch(`${API}/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      salary: Number(salary),
      savingsPercent: Number(savingsPercent),
      emiAmount: Number(emiAmount)
    })
  });

  alert("Setup saved");
  loadSetupPage();
  loadDashboard();
}

function renderSetupPreview(setup) {
  const box = document.getElementById("setupPreview");
  if (!box) return;

  const salary = Number(setup.salary || 0);
  const savingsPercent = Number(setup.savingsPercent || 20);
  const emiAmount = Number(setup.emiAmount || 0);

  const savings = (salary * savingsPercent) / 100;
  const needs = salary * 0.5;
  const wants = salary * 0.3;
  const remaining = salary - savings - emiAmount;

  box.innerHTML = `
    <div class="kpi">
      <div class="kpi-box">
        <div class="kpi-label">Salary</div>
        <div class="kpi-value">${money(salary)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Savings</div>
        <div class="kpi-value">${money(savings)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">EMI</div>
        <div class="kpi-value">${money(emiAmount)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">After Plan</div>
        <div class="kpi-value">${money(remaining)}</div>
      </div>
    </div>

    <span class="badge good">Needs 50%: ${money(needs)}</span>
    <span class="badge warn">Wants 30%: ${money(wants)}</span>
    <span class="badge good">Savings ${savingsPercent}%</span>
    <span class="badge ${emiAmount > 0 ? "warn" : "good"}">EMI ${money(emiAmount)}</span>
  `;
}

async function loadSetupPage() {
  const data = await fetchData();

  const salary = document.getElementById("salary");
  const savings = document.getElementById("savings");
  const emi = document.getElementById("emi");

  if (salary) salary.value = data.setup.salary || 0;
  if (savings) savings.value = data.setup.savingsPercent ?? 20;
  if (emi) emi.value = data.setup.emiAmount || 0;

  renderSetupPreview(data.setup);
}

function setupCategoryDropdown(categories) {
  const select = document.getElementById("category");
  const custom = document.getElementById("customCategory");

  if (!select) return;

  select.innerHTML = `
    <option value="">Select category</option>
    ${categories.map(c => `<option value="${c}">${c}</option>`).join("")}
    <option value="__other__">Other...</option>
  `;

  if (custom) {
    custom.classList.add("hidden");
    select.addEventListener("change", () => {
      if (select.value === "__other__") {
        custom.classList.remove("hidden");
      } else {
        custom.classList.add("hidden");
      }
    });
  }
}

async function addTransaction() {
  const title = document.getElementById("title")?.value.trim();
  const amount = Number(document.getElementById("amount")?.value || 0);
  const type = document.getElementById("type")?.value || "expense";
  const date = document.getElementById("date")?.value || todayISO();

  const categorySelect = document.getElementById("category");
  const customCategory = document.getElementById("customCategory");

  let category = categorySelect?.value || "Others";

  if (category === "__other__") {
    category = customCategory?.value.trim();
  }

  if (!title || !amount || !category) {
    alert("Please fill title, amount, and category");
    return;
  }

  await fetch(`${API}/transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      amount,
      type,
      category,
      date
    })
  });

  alert("Transaction added");
  await loadTransactionsPage();
  await loadDashboard();
  await loadReportPage();
}

async function deleteTransaction(id) {
  await fetch(`${API}/transaction/${id}`, {
    method: "DELETE"
  });

  await loadTransactionsPage();
  await loadDashboard();
  await loadReportPage();
}

function renderTransactionsList(transactions) {
  const list = document.getElementById("list");
  if (!list) return;

  if (!transactions.length) {
    list.innerHTML = `<div class="muted">No transactions yet.</div>`;
    return;
  }

  list.innerHTML = transactions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(t => `
      <div class="list-item">
        <div>
          <strong>${t.title}</strong>
          <small>${t.category} • ${t.type} • ${new Date(t.date).toLocaleDateString()}</small>
        </div>
        <div class="flex-between">
          <strong>${t.type === "income" ? "+" : "-"} ${money(t.amount)}</strong>
          <button class="danger small-btn" onclick="deleteTransaction(${t.id})">Delete</button>
        </div>
      </div>
    `)
    .join("");
}

async function loadTransactionsPage() {
  const data = await fetchData();

  setupCategoryDropdown(data.categories || []);
  renderTransactionsList(data.transactions || []);

  const dateInput = document.getElementById("date");
  if (dateInput && !dateInput.value) {
    dateInput.value = todayISO();
  }
}

function destroyChart(chart) {
  if (chart) chart.destroy();
}

async function loadDashboard() {
  const data = await fetchData();

  const month = currentMonthKey();
  const monthTx = (data.transactions || []).filter(t => monthKey(t.date) === month);

  let income = 0;
  let expense = 0;
  const categoryExpense = {};

  monthTx.forEach(t => {
    const amt = Number(t.amount || 0);
    if (t.type === "income") {
      income += amt;
    } else {
      expense += amt;
      categoryExpense[t.category] = (categoryExpense[t.category] || 0) + amt;
    }
  });

const salary = Number(data.setup?.salary || 0);
const savingsPercent = Number(data.setup?.savingsPercent || 20);
const emiAmount = Number(data.setup?.emiAmount || 0);

// Savings reserved first
let savingsTarget = (salary * savingsPercent) / 100;

// Available money after EMI and savings
let availableBalance = salary - emiAmount - savingsTarget;

// Current month expenses
availableBalance -= expense;

// If expenses exceed balance, use savings
if (availableBalance < 0) {
  const deficit = Math.abs(availableBalance);

  savingsTarget -= deficit;

  if (savingsTarget < 0) {
    savingsTarget = 0;
  }

  availableBalance = 0;
}

const balance = availableBalance;

  const incomeEl = document.getElementById("income");
  const expenseEl = document.getElementById("expense");
  const balanceEl = document.getElementById("balance");
  const savingsEl = document.getElementById("savingsTarget");
  const monthLabelEl = document.getElementById("dashboardMonthLabel");

  if (!incomeEl || !expenseEl || !savingsEl) return;

  if (monthLabelEl) {
    monthLabelEl.innerText = `Current Month: ${monthLabel(month)}`;
  }

  incomeEl.innerText = money(income);
  expenseEl.innerText = money(expense);
  balanceEl.innerText = money(balance);
  savingsEl.innerText = money(savingsTarget);

  const ctx = document.getElementById("chart");
  if (!ctx) return;

  destroyChart(dashboardChart);

  dashboardChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Income", "Expense"],
      datasets: [{
        data: [income, expense]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function fillMonthDropdown(months) {
  const select = document.getElementById("reportMonth");
  if (!select) return;

  select.innerHTML = months.map(m => `
    <option value="${m}">${monthLabel(m)}</option>
  `).join("");
}

function renderReportForMonth(data, key) {
  const monthTx = (data.transactions || [])
    .filter(t => monthKey(t.date) === key)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let income = 0;
  let expense = 0;
  const categoryMap = {};

  monthTx.forEach(t => {
    const amt = Number(t.amount || 0);
    if (t.type === "income") {
      income += amt;
    } else {
      expense += amt;
      categoryMap[t.category] = (categoryMap[t.category] || 0) + amt;
    }
  });

  const balance = income - expense;
  const savings = balance;

  const incomeEl = document.getElementById("r_income");
  const expenseEl = document.getElementById("r_expense");
  const balanceEl = document.getElementById("r_balance");
  const savingsEl = document.getElementById("r_savings");
  const labelEl = document.getElementById("reportLabel");
  const listEl = document.getElementById("reportList");

  if (incomeEl) incomeEl.innerText = money(income);
  if (expenseEl) expenseEl.innerText = money(expense);
  if (balanceEl) balanceEl.innerText = money(balance);
  if (savingsEl) savingsEl.innerText = money(savings);
  if (labelEl) labelEl.innerText = `Report for ${monthLabel(key)}`;

  if (listEl) {
    if (!monthTx.length) {
      listEl.innerHTML = `<div class="muted">No transactions in this month.</div>`;
    } else {
      listEl.innerHTML = monthTx.map(t => `
        <div class="list-item">
          <div>
            <strong>${t.title}</strong>
            <small>${new Date(t.date).toLocaleDateString()} • ${t.category} • ${t.type}</small>
          </div>
          <div>
            <strong>${t.type === "income" ? "+" : "-"} ${money(t.amount)}</strong>
          </div>
        </div>
      `).join("");
    }
  }

  const barCtx = document.getElementById("reportBarChart");
  const pieCtx = document.getElementById("reportCategoryChart");

  if (barCtx) {
    destroyChart(reportSummaryChart);
    reportSummaryChart = new Chart(barCtx, {
      type: "bar",
      data: {
        labels: ["Income", "Expense", "Balance"],
        datasets: [{
          label: monthLabel(key),
          data: [income, expense, balance]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  if (pieCtx) {
    destroyChart(reportCategoryChart);

    const labels = Object.keys(categoryMap);
    const values = Object.values(categoryMap);

    reportCategoryChart = new Chart(pieCtx, {
      type: "doughnut",
      data: {
        labels: labels.length ? labels : ["No Expense"],
        datasets: [{
          data: values.length ? values : [1]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}

async function loadReportPage() {
  const data = await fetchData();

  const months = Array.from(
    new Set([
      currentMonthKey(),
      ...(data.transactions || []).map(t => monthKey(t.date)).filter(Boolean)
    ])
  ).sort((a, b) => b.localeCompare(a));

  fillMonthDropdown(months);

  const select = document.getElementById("reportMonth");
  if (!select) return;

  const selected = months[0] || currentMonthKey();
  select.value = selected;

  select.onchange = () => {
    renderReportForMonth(data, select.value);
  };

  renderReportForMonth(data, selected);
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;

  if (page === "setup") {
    await loadSetupPage();
  }

  if (page === "dashboard") {
    await loadDashboard();
  }

  if (page === "transactions") {
    await loadTransactionsPage();
  }

  if (page === "report") {
    await loadReportPage();
  }
});