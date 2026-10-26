// Method-2:
// Supabase will verify whether the student is logged in.
// We will add this verification in a later step.
const $ = (s) => document.querySelector(s);
const COLORS = [
  "#1f8a5f",
  "#27a96f",
  "#7fd1a8",
  "#0f3d2e",
  "#f08c1a",
  "#e04848",
  "#5aa9e6",
  "#b5c7bd",
];
const ICONS = {
  Food: "🍔",
  Transport: "🚌",
  Books: "📚",
  Rent: "🏠",
  Entertainment: "🎬",
  Shopping: "🛍️",
  Health: "💊",
  Other: "📦",
  Allowance: "👪",
  "Part-time Job": "💼",
  Scholarship: "🎓",
  Freelance: "💻",
  Gift: "🎁",
};
const charts = {};

let currentUser = null;
let profile = {};
let data = {
  expenses: [],
  income: [],
  budget: {
    monthly: 15000,
    categories: {},
  },
};

const thisMonth = () => new Date().toISOString().slice(0, 7);
const sum = (arr) => arr.reduce((a, x) => a + Number(x.amount), 0);
const monthExpenses = (m = thisMonth()) =>
  data.expenses.filter((e) => e.date.startsWith(m));
function lastMonths(n = 6) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setMonth(d.getMonth() - i);
    out.push({
      key: x.toISOString().slice(0, 7),
      label: x.toLocaleDateString("en-IN", { month: "short" }),
    });
  }
  return out;
}
function byCategory(list) {
  const r = {};
  list.forEach(
    (e) => (r[e.category] = (r[e.category] || 0) + Number(e.amount)),
  );
  return r;
}
function persist() {
  renderAll();
}

async function initializeDashboard() {
  // Step 1: Check whether a student is logged in to Supabase
  const { data: authData, error: authError } =
    await supabaseClient.auth.getUser();

  if (authError || !authData.user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = authData.user;


  // Step 2: Load the student's profile
  const { data: profileData, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile loading error:", profileError);
    alert("Could not load your profile.");
    return;
  }
  profile = profileData || {};


  // Step 3: Load the student's transactions
  const { data: transactions, error: transactionError } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: false });

  if (transactionError) {
    console.error("Transaction loading error:", transactionError);
    alert("Could not load transactions.");
    return;
  }


  // Separate expenses and income
  data.expenses = (transactions || [])
    .filter((t) => t.type === "expense")
    .map((t) => ({
      id: t.id,
      title: t.title,
      amount: Number(t.amount),
      category: t.category,
      date: t.date,
      method: t.method || "",
      description: t.description || "",
    }));

  data.income = (transactions || [])
    .filter((t) => t.type === "income")
    .map((t) => ({
      id: t.id,
      source: t.title,
      amount: Number(t.amount),
      category: t.category,
      date: t.date,
      description: t.description || "",
    }));

  // Step 4: Load the student's budget
  const { data: budgetData, error: budgetError } = await supabaseClient
    .from("budgets")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (budgetError) {
    console.error("Budget loading error:", budgetError);
    alert("Could not load your budget.");
    return;
  }
  if (budgetData) {
    data.budget.monthly = Number(budgetData.monthly_limit);
    data.budget.categories = budgetData.category_limits || {};
  }

  // Step 5: Refresh the dashboard using the loaded data
  fillSelects();
  resetExpForm();
  resetIncForm();
  route();
}


function drawChart(id, config) {
  if (typeof Chart === "undefined") return;
  if (charts[id]) charts[id].destroy();
  Chart.defaults.font.family = "Plus Jakarta Sans";
  Chart.defaults.color = "#6b7a73";
  charts[id] = new Chart(document.getElementById(id), {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...config.options,
    },
  });
}

// ---------- Navigation ----------
const TITLES = {
  dashboard: "Dashboard",
  expenses: "Expenses",
  income: "Income",
  budget: "Budget",
  analytics: "Analytics",
  profile: "Profile",
};
function route() {
  const p = TITLES[location.hash.slice(1)]
    ? location.hash.slice(1)
    : "dashboard";
  document
    .querySelectorAll(".page")
    .forEach((s) => s.classList.toggle("active", s.id === "page-" + p));
  document
    .querySelectorAll(".nav a[data-page]")
    .forEach((a) => a.classList.toggle("active", a.dataset.page === p));
  $("#pageTitle").textContent = TITLES[p];
  document.title = TITLES[p] + " · PocketWise";
  $("#sidebar").classList.remove("open");
  renderAll();
}
window.addEventListener("hashchange", route);
$("#menuBtn").onclick = () => $("#sidebar").classList.add("open");
$("#overlay").onclick = () => $("#sidebar").classList.remove("open");
$("#logoutBtn").onclick = async (e) => {
  e.preventDefault();

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Logout error:", error);
    alert("Could not log out. Please try again.");
    return;
  }

  window.location.href = "index.html";
};
$("#today").textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// ---------- Confirm modal ----------

function confirmBox(title, text) {
  return new Promise((res) => {
    $("#mTitle").textContent = title;
    $("#mText").textContent = text;
    $("#confirmModal").classList.add("open");

    const close = (v) => {
      $("#confirmModal").classList.remove("open");
      res(v);
    };

    $("#mOk").onclick = () => close(true);
    $("#mCancel").onclick = () => close(false);
  });
}

// ---------- Header ----------
function renderHeader() {
  const u = currentUser;
  if (!u) return;

  const name = profile.full_name || u.email || "Student";
  const email = u.email || "";
  const college = profile.college || "Student";

  const init = name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  $("#hName").textContent = name;
  $("#hCollege").textContent = college;
  $("#hAvatar").textContent = init;

  $("#pAvatar").textContent = init;
  $("#pName").textContent = name;
  $("#pEmail").textContent = email;
}

//---------- Dashboard ----------
function budgetRow(label, spent, limit) {
  const pct = limit ? (spent / limit) * 100 : 0;
  const cls = pct >= 100 ? "over" : pct >= 80 ? "warn" : "";
  return `<div class="prog"><div class="prog-head"><b>${esc(label)}</b><span>${fmt(spent)} / ${fmt(limit)} · ${Math.round(pct)}%</span></div>
    <div class="bar ${cls}"><i style="width:${Math.min(pct, 100)}%"></i></div></div>`;
}
function renderDashboard() {
  const ti = sum(data.income),
    te = sum(data.expenses);
  $("#dBalance").textContent = fmt(ti - te);
  $("#dIncome").textContent = fmt(ti);
  $("#dExpense").textContent = fmt(te);
  $("#dBudget").textContent = fmt(data.budget.monthly);

  const all = [
    ...data.expenses.map((e) => ({ ...e, type: "e", name: e.title })),
    ...data.income.map((i) => ({ ...i, type: "i", name: i.source })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  $("#recent").innerHTML =
    all
      .map(
        (
          t,
        ) => `<div class="tx"><div class="ti">${ICONS[t.category] || "•"}</div>
    <div class="tt"><b>${esc(t.name)}</b><small>${t.category} · ${fmtDate(t.date)}</small></div>
    <div class="${t.type === "e" ? "amt-neg" : "amt-pos"}">${t.type === "e" ? "−" : "+"}${fmt(t.amount)}</div></div>`,
      )
      .join("") || `<div class="empty">No transactions yet</div>`;

  const me = monthExpenses(),
    spent = sum(me),
    cats = byCategory(me);
  $("#dProgress").innerHTML =
    budgetRow("Overall", spent, data.budget.monthly) +
    Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c, v]) => budgetRow(c, v, data.budget.categories[c] || 0))
      .join("");

  const months = lastMonths();
  const mVals = months.map((m) => sum(monthExpenses(m.key)));
  const prev = mVals[mVals.length - 2] || 0;
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  const daysLeft =
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() -
    new Date().getDate() +
    1;
  const left = data.budget.monthly - spent;
  const ins = [
    [
      "📈",
      prev
        ? `You've spent <b>${fmt(spent)}</b> this month — ${spent > prev ? "up" : "down"} ${Math.abs(Math.round(((spent - prev) / prev) * 100))}% vs last month.`
        : `You've spent <b>${fmt(spent)}</b> this month.`,
    ],
    top
      ? [
          "🏷️",
          `<b>${top[0]}</b> is your biggest category this month (${fmt(top[1])}).`,
        ]
      : null,
    left > 0
      ? [
          "💡",
          `You can spend about <b>${fmt(left / daysLeft)}/day</b> for the remaining ${daysLeft} days.`,
        ]
      : ["⚠️", `You're <b>${fmt(-left)}</b> over your monthly budget.`],
    ti > te
      ? [
          "🎯",
          `You've saved <b>${Math.round(((ti - te) / ti) * 100)}%</b> of your total income. Keep it up!`,
        ]
      : ["🔻", "Your expenses exceed your income overall."],
  ].filter(Boolean);
  $("#insights").innerHTML = ins
    .map(
      ([i, t]) =>
        `<div class="insight"><span>${i}</span><span>${t}</span></div>`,
    )
    .join("");

  drawChart("cMonthly", {
    type: "bar",
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: "Expenses",
          data: mVals,
          backgroundColor: months.map((_, i) =>
            i === months.length - 1 ? "#1f8a5f" : "#bfe6d2",
          ),
          borderRadius: 8,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "#eef2f0" } },
      },
    },
  });
  drawChart("cCat", {
    type: "doughnut",
    data: {
      labels: Object.keys(cats),
      datasets: [
        { data: Object.values(cats), backgroundColor: COLORS, borderWidth: 0 },
      ],
    },
    options: {
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 10, usePointStyle: true },
        },
      },
    },
  });
}

// ---------- Expenses ----------
function fillSelects() {
  document
    .querySelectorAll(".exp-cats")
    .forEach(
      (s) =>
        (s.innerHTML = Store.EXPENSE_CATS.map(
          (c) => `<option>${c}</option>`,
        ).join("")),
    );
  document
    .querySelectorAll(".inc-cats")
    .forEach(
      (s) =>
        (s.innerHTML = Store.INCOME_CATS.map(
          (c) => `<option>${c}</option>`,
        ).join("")),
    );
  $("#expFilter").innerHTML =
    `<option value="">All categories</option>` +
    Store.EXPENSE_CATS.map((c) => `<option>${c}</option>`).join("");
  $("#incFilter").innerHTML =
    `<option value="">All categories</option>` +
    Store.INCOME_CATS.map((c) => `<option>${c}</option>`).join("");
}
function renderExpenses() {
  const q = $("#expSearch").value.toLowerCase(),
    cat = $("#expFilter").value,
    [key, dir] = $("#expSort").value.split("-");
  const list = data.expenses
    .filter(
      (e) =>
        (!cat || e.category === cat) &&
        (e.title + e.description).toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const r =
        key === "amount" ? a.amount - b.amount : a.date.localeCompare(b.date);
      return dir === "asc" ? r : -r;
    });
  $("#expTotal").textContent = `${list.length} items · ${fmt(sum(list))}`;
  $("#expTable").innerHTML =
    list
      .map(
        (
          e,
        ) => `<tr><td><b>${esc(e.title)}</b></td><td><span class="badge">${ICONS[e.category] || ""} ${e.category}</span></td>
    <td>${fmtDate(e.date)}</td><td>${esc(e.method)}</td><td class="amt-neg">${fmt(e.amount)}</td>
    <td><div class="actions"><button class="btn btn-ghost btn-sm" data-edit-exp="${e.id}">Edit</button><button class="btn btn-sm btn-danger" data-del-exp="${e.id}">Delete</button></div></td></tr>`,
      )
      .join("") ||
    `<tr><td colspan="6" class="empty">No expenses found</td></tr>`;
}
function resetExpForm() {
  const f = $("#expForm");
  f.reset();
  f.id.value = "";
  f.date.value = new Date().toISOString().slice(0, 10);
  $("#expFormTitle").textContent = "Add Expense";
  $("#expCancel").hidden = true;
  f.querySelectorAll(".field").forEach((x) => x.classList.remove("invalid"));
  f.querySelectorAll(".err").forEach((x) => (x.textContent = ""));
}

$("#expForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const f = ev.target;

  if (
    !validate(f, {
      title: [req("Title")],
      amount: [positive],
      date: [req("Date")],
      category: [req("Category")],
    })
  )
    return;

  if (!currentUser) {
    toast("Please log in again.", "error");
    return;
  }

  const id = f.id.value;

  const item = {
    user_id: currentUser.id,
    type: "expense",
    title: f.title.value.trim(),
    amount: Number(f.amount.value),
    category: f.category.value,
    date: f.date.value,
    method: f.method.value,
    description: f.description.value.trim(),
  };

  let result;

  if (id) {
    // Update an existing expense
    result = await supabaseClient
      .from("transactions")
      .update(item)
      .eq("id", id)
      .eq("user_id", currentUser.id)
      .select();
  } else {
    // Insert a new expense
    result = await supabaseClient.from("transactions").insert(item);
  }

  if (result.error) {
    console.error("Expense save error:", result.error);
    toast("Could not save expense. Please try again.", "error");
    return;
  }

  toast(id ? "Expense updated" : "Expense added");

  await initializeDashboard();
  resetExpForm();

  const mb = sum(monthExpenses());

  if (mb > data.budget.monthly) {
    toast("Heads up: monthly budget exceeded!", "error");
  }
});

$("#expCancel").onclick = resetExpForm;
["#expSearch", "#expFilter", "#expSort"].forEach((s) =>
  $(s).addEventListener("input", renderExpenses),
);

//--------- Income ----------
function renderIncome() {
  const q = $("#incSearch").value.toLowerCase(),
    cat = $("#incFilter").value;
  const list = data.income
    .filter(
      (e) =>
        (!cat || e.category === cat) &&
        (e.source + e.description).toLowerCase().includes(q),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  $("#incTotal").textContent = `${list.length} items · ${fmt(sum(list))}`;
  $("#incTable").innerHTML =
    list
      .map(
        (
          e,
        ) => `<tr><td><b>${esc(e.source)}</b></td><td><span class="badge">${ICONS[e.category] || ""} ${e.category}</span></td>
    <td>${fmtDate(e.date)}</td><td class="amt-pos">${fmt(e.amount)}</td>
    <td><div class="actions"><button class="btn btn-ghost btn-sm" data-edit-inc="${e.id}">Edit</button><button class="btn btn-sm btn-danger" data-del-inc="${e.id}">Delete</button></div></td></tr>`,
      )
      .join("") ||
    `<tr><td colspan="5" class="empty">No income found</td></tr>`;
}
function resetIncForm() {
  const f = $("#incForm");
  f.reset();
  f.id.value = "";
  f.date.value = new Date().toISOString().slice(0, 10);
  $("#incFormTitle").textContent = "Add Income";
  $("#incCancel").hidden = true;
  f.querySelectorAll(".field").forEach((x) => x.classList.remove("invalid"));
  f.querySelectorAll(".err").forEach((x) => (x.textContent = ""));
}

$("#incForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const f = ev.target;

  if (
    !validate(f, {
      source: [req("Source")],
      amount: [positive],
      date: [req("Date")],
    })
  )
    return;

  if (!currentUser) {
    toast("Please log in again.", "error");
    return;
  }

  const id = f.id.value;

  const item = {
    user_id: currentUser.id,
    type: "income",
    title: f.source.value.trim(),
    amount: Number(f.amount.value),
    category: f.category.value,
    date: f.date.value,
    description: f.description.value.trim(),
  };

  let result;

  if (id) {
    // Update existing income
    result = await supabaseClient
      .from("transactions")
      .update(item)
      .eq("id", id)
      .eq("user_id", currentUser.id)
      .eq("type", "income")
      .select();
  } else {
    // Insert new income
    result = await supabaseClient.from("transactions").insert(item);
  }

  if (result.error) {
    console.error("Income save error:", result.error);
    toast("Could not save income. Please try again.", "error");
    return;
  }

  if (id && (!result.data || result.data.length === 0)) {
    toast("Income not found or could not be updated.", "error");
    return;
  }

  toast(id ? "Income updated" : "Income added");

  await initializeDashboard();
  resetIncForm();
});

$("#incCancel").onclick = resetIncForm;
["#incSearch", "#incFilter"].forEach((s) =>
  $(s).addEventListener("input", renderIncome),
);

// Table action delegation

document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;

  const d = b.dataset;

  // Edit expense
  if (d.editExp) {
    const e = data.expenses.find((x) => x.id === d.editExp);
    if (!e) return;

    const f = $("#expForm");
    Object.entries(e).forEach(([k, v]) => {
      if (f.elements[k]) f.elements[k].value = v;
    });

    $("#expFormTitle").textContent = "Edit Expense";
    $("#expCancel").hidden = false;
    f.scrollIntoView({ behavior: "smooth" });
  }

  // Edit income
  if (d.editInc) {
    const e = data.income.find((x) => x.id === d.editInc);
    if (!e) return;

    const f = $("#incForm");
    f.elements.source.value = e.source;
    f.elements.id.value = e.id;
    f.elements.amount.value = e.amount;
    f.elements.category.value = e.category;
    f.elements.date.value = e.date;
    f.elements.description.value = e.description || "";

    $("#incFormTitle").textContent = "Edit Income";
    $("#incCancel").hidden = false;
    f.scrollIntoView({ behavior: "smooth" });
  }

  // Delete expense from Supabase
  if (d.delExp) {
    if (
      !(await confirmBox(
        "Delete expense?",
        "This expense will be permanently removed.",
      ))
    )
      return;

    const { error } = await supabaseClient
      .from("transactions")
      .delete()
      .eq("id", d.delExp)
      .eq("user_id", currentUser.id)
      .eq("type", "expense");

    if (error) {
      console.error("Delete expense error:", error);
      toast("Could not delete expense.", "error");
      return;
    }

    toast("Expense deleted");
    await initializeDashboard();
  }

  // Delete income from Supabase
  if (d.delInc) {
    if (
      !(await confirmBox(
        "Delete income?",
        "This income entry will be permanently removed.",
      ))
    )
      return;

    const { error } = await supabaseClient
      .from("transactions")
      .delete()
      .eq("id", d.delInc)
      .eq("user_id", currentUser.id)
      .eq("type", "income");

    if (error) {
      console.error("Delete income error:", error);
      toast("Could not delete income.", "error");
      return;
    }

    toast("Income deleted");
    await initializeDashboard();
  }
});

// ---------- Budget ----------
function renderBudget() {
  const f = $("#budgetForm");
  f.monthly.value = data.budget.monthly;
  $("#catBudgetFields").innerHTML = Store.EXPENSE_CATS.map(
    (c) =>
      `<div class="field"><label>${ICONS[c]} ${c}</label><input type="number" name="cat_${c}" value="${data.budget.categories[c] || 0}"></div>`,
  ).join("");
  const me = monthExpenses(),
    spent = sum(me),
    cats = byCategory(me),
    pct = (spent / data.budget.monthly) * 100;
  $("#bOverall").innerHTML =
    budgetRow("Monthly budget", spent, data.budget.monthly) +
    `<div class="row2" style="margin-top:8px"><div><small style="color:var(--muted)">Spent</small><div class="amt-neg" style="font-size:20px">${fmt(spent)}</div></div>
     <div><small style="color:var(--muted)">Remaining</small><div class="${spent > data.budget.monthly ? "amt-neg" : "amt-pos"}" style="font-size:20px">${fmt(data.budget.monthly - spent)}</div></div></div>`;
  const alerts = [];
  if (pct >= 100)
    alerts.push(
      `<div class="alert over">⛔ You've exceeded your monthly budget by ${fmt(spent - data.budget.monthly)}.</div>`,
    );
  else if (pct >= 80)
    alerts.push(
      `<div class="alert warn">⚠️ You've used ${Math.round(pct)}% of your monthly budget.</div>`,
    );
  Store.EXPENSE_CATS.forEach((c) => {
    const l = data.budget.categories[c] || 0,
      s = cats[c] || 0;
    if (l && s > l)
      alerts.push(
        `<div class="alert over">⛔ ${c} is over budget by ${fmt(s - l)}.</div>`,
      );
    else if (l && s >= l * 0.8)
      alerts.push(
        `<div class="alert warn">⚠️ ${c} is at ${Math.round((s / l) * 100)}% of its budget.</div>`,
      );
  });
  $("#bAlerts").innerHTML =
    alerts.join("") ||
    `<div class="alert ok">✅ All budgets are on track this month.</div>`;
  $("#bCards").innerHTML = Store.EXPENSE_CATS.map((c) => {
    const l = data.budget.categories[c] || 0,
      s = cats[c] || 0,
      p = l ? (s / l) * 100 : 0;
    const cls = p >= 100 ? "over" : p >= 80 ? "warn" : "";
    return `<div class="card bcard"><h3>${ICONS[c]} ${c} <span class="badge">${Math.round(p)}%</span></h3><div class="big">${fmt(s)} <small style="color:var(--muted);font-size:13px;font-weight:500">of ${fmt(l)}</small></div>
      <div class="bar ${cls}" style="margin-top:10px"><i style="width:${Math.min(p, 100)}%"></i></div>
      <div class="meta"><span>Remaining</span><b class="${l - s < 0 ? "amt-neg" : ""}">${fmt(l - s)}</b></div></div>`;
  }).join("");
}

$("#budgetForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const f = ev.target;

  if (!validate(f, { monthly: [positive] })) return;

  if (!currentUser) {
    toast("Please log in again.", "error");
    return;
  }

  const monthlyLimit = Number(f.monthly.value);
  const categoryLimits = {};

  Store.EXPENSE_CATS.forEach((c) => {
    categoryLimits[c] = Math.max(0, Number(f.elements["cat_" + c].value) || 0);
  });

  const { error } = await supabaseClient.from("budgets").upsert(
    {
      user_id: currentUser.id,
      monthly_limit: monthlyLimit,
      category_limits: categoryLimits,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Budget save error:", error);
    toast("Could not save budgets. Please try again.", "error");
    return;
  }

  toast("Budgets saved");
  await initializeDashboard();
});

//---------- Analytics ----------
function renderAnalytics() {
  const months = lastMonths(),
    ti = sum(data.income),
    te = sum(data.expenses),
    cats = byCategory(data.expenses);
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  const high = [...data.expenses].sort((a, b) => b.amount - a.amount)[0];
  const mE = months.map((m) => sum(monthExpenses(m.key))),
    mI = months.map((m) =>
      sum(data.income.filter((i) => i.date.startsWith(m.key))),
    );
  const active = mE.filter((v) => v > 0);
  $("#aTop").textContent = top ? top[0] : "—";
  $("#aAvg").textContent = fmt(
    active.length
      ? sum(active.map((amount) => ({ amount }))) / active.length
      : 0,
  );
  $("#aCount").textContent = data.expenses.length + data.income.length;
  $("#aHigh").textContent = high ? fmt(high.amount) : "—";
  $("#aHigh").title = high ? high.title : "";
  const saved = ti - te,
    rate = ti ? Math.max(0, (saved / ti) * 100) : 0;
  $("#aSave").textContent = fmt(saved);
  $("#aRate").textContent = Math.round(rate) + "%";
  $("#aRateBar").style.width = Math.min(rate, 100) + "%";
  $("#aSaveMonths").innerHTML = months
    .slice()
    .reverse()
    .slice(0, 4)
    .map((m, i) => {
      const idx = months.length - 1 - i,
        s = mI[idx] - mE[idx];
      return `<div class="tx"><div class="tt"><b>${m.label}</b></div><div class="${s >= 0 ? "amt-pos" : "amt-neg"}">${s >= 0 ? "+" : "−"}${fmt(Math.abs(s))}</div></div>`;
    })
    .join("");
  const grid = {
    x: { grid: { display: false } },
    y: { grid: { color: "#eef2f0" } },
  };
  drawChart("aMonthly", {
    type: "line",
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: "Spending",
          data: mE,
          borderColor: "#1f8a5f",
          backgroundColor: "rgba(39,169,111,.12)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#1f8a5f",
        },
      ],
    },
    options: { plugins: { legend: { display: false } }, scales: grid },
  });
  drawChart("aCat", {
    type: "pie",
    data: {
      labels: Object.keys(cats),
      datasets: [
        {
          data: Object.values(cats),
          backgroundColor: COLORS,
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 10, usePointStyle: true },
        },
      },
    },
  });
  drawChart("aIvE", {
    type: "bar",
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: "Income",
          data: mI,
          backgroundColor: "#27a96f",
          borderRadius: 6,
        },
        {
          label: "Expenses",
          data: mE,
          backgroundColor: "#e04848",
          borderRadius: 6,
        },
      ],
    },
    options: { scales: grid },
  });
}

// ---------- Profile ----------

// ---------- Profile ----------
function renderProfile() {
  if (!currentUser) return;

  const p = profile || {};
  const f = $("#profileForm");

  f.name.value = p.full_name || "";
  ["phone", "college", "course", "year", "city"].forEach((k) => {
    f.elements[k].value = p[k] || "";
  });

  $("#pInfo").innerHTML = [
    ["College", p.college],
    ["Course", p.course],
    ["Year", p.year],
    ["Phone", p.phone],
    ["City", p.city],
    ["Monthly budget", fmt(data.budget.monthly)],
  ]
    .map(
      ([k, v]) =>
        `<div class="tx"><div class="tt"><small>${k}</small><b>${esc(v || "—")}</b></div></div>`,
    )
    .join("");
}

// Save profile to Supabase
$("#profileForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const f = ev.target;

  if (
    !validate(f, {
      name: [req("Name")],
      phone: [
        (v) =>
          !v || /^\d{10}$/.test(v) ? null : "Enter a 10-digit phone number",
      ],
    })
  )
    return;

  if (!currentUser) {
    toast("Please log in again.", "error");
    return;
  }

  const updatedProfile = {
    id: currentUser.id,
    full_name: f.name.value.trim(),
    phone: f.phone.value.trim(),
    college: f.college.value.trim(),
    course: f.course.value.trim(),
    year: f.year.value.trim(),
    city: f.city.value.trim(),
  };

  const { error } = await supabaseClient
    .from("profiles")
    .upsert(updatedProfile, { onConflict: "id" });

  if (error) {
    console.error("Profile update error:", error);
    toast("Could not update profile.", "error");
    return;
  }

  toast("Profile updated");
  await initializeDashboard();
});

// Reset data: delete this student's transactions from Supabase
$("#resetData").onclick = async () => {
  const confirmed = await confirmBox(
    "Reset data?",
    "This permanently deletes all your income and expense transactions. Your profile and budget will remain.",
  );

  if (!confirmed) return;

  if (!currentUser) {
    toast("Please log in again.", "error");
    return;
  }

  const { error } = await supabaseClient
    .from("transactions")
    .delete()
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("Reset data error:", error);
    toast("Could not reset transactions.", "error");
    return;
  }

  toast("Transactions cleared");
  await initializeDashboard();
};
function renderAll() {
  renderHeader();
  renderDashboard();
  renderExpenses();
  renderIncome();
  renderBudget();
  renderAnalytics();
  renderProfile();
}
initializeDashboard();
