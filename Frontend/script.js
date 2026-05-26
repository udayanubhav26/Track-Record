const setupMonth = document.getElementById("setupMonth");

const now = new Date();

// create month list (Jan - Dec)
for (let i = 0; i < 12; i++) {
  const option = document.createElement("option");
  option.value = i;
  option.text = new Date(2026, i).toLocaleString('default', { month: 'long' });

  setupMonth.appendChild(option);
}

// default selected month = current month
setupMonth.value = now.getMonth();