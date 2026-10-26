// Shared data layer (localStorage) + helpers
const Store = (() => {
  const USERS = "set_users",
    SESSION = "set_session";
  const read = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => Math.random().toString(36).slice(2, 10);

  const EXPENSE_CATS = [
    "Food",
    "Transport",
    "Books",
    "Rent",
    "Entertainment",
    "Shopping",
    "Health",
    "Other",
  ];
  const INCOME_CATS = [
    "Allowance",
    "Part-time Job",
    "Scholarship",
    "Freelance",
    "Gift",
    "Other",
  ];

  function iso(monthsAgo, day) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - monthsAgo);
    d.setDate(Math.min(day, 28));
    return d.toISOString().slice(0, 10);
  }

  function sampleData() {
    const e = [],
      inc = [];
    const items = [
      ["Hostel rent", 6000, "Rent", 1, "UPI"],
      ["Mess / groceries", 2200, "Food", 4, "UPI"],
      ["Metro card recharge", 500, "Transport", 6, "Card"],
      ["Data structures textbook", 850, "Books", 9, "Cash"],
      ["Movie with friends", 420, "Entertainment", 12, "UPI"],
      ["Cafe & snacks", 640, "Food", 15, "Cash"],
      ["New sneakers", 1800, "Shopping", 18, "Card"],
      ["Pharmacy", 300, "Health", 21, "Cash"],
      ["Auto rides", 380, "Transport", 24, "Cash"],
      ["Stationery", 220, "Other", 26, "UPI"],
    ];
    for (let m = 5; m >= 0; m--) {
      items.forEach(([t, a, c, d, p], i) => {
        if (m === 0 && d > new Date().getDate() + 3) return;
        if ((i + m) % 4 === 3 && c !== "Rent") return;
        const v = Math.round(a * (0.8 + ((i * 7 + m * 3) % 5) / 10));
        e.push({
          id: uid(),
          title: t,
          amount: v,
          category: c,
          date: iso(m, d),
          method: p,
          description: "",
        });
      });
      inc.push({
        id: uid(),
        source: "Monthly allowance from parents",
        amount: 12000,
        category: "Allowance",
        date: iso(m, 1),
        description: "",
      });
      inc.push({
        id: uid(),
        source: "Campus library assistant",
        amount: 3500 + (m % 3) * 500,
        category: "Part-time Job",
        date: iso(m, 10),
        description: "",
      });
      if (m === 2)
        inc.push({
          id: uid(),
          source: "Merit scholarship",
          amount: 10000,
          category: "Scholarship",
          date: iso(m, 15),
          description: "Semester award",
        });
      if (m === 0 || m === 3)
        inc.push({
          id: uid(),
          source: "Logo design gig",
          amount: 2000,
          category: "Freelance",
          date: iso(m, 8),
          description: "",
        });
    }
    return {
      expenses: e,
      income: inc,
      budget: {
        monthly: 15000,
        categories: {
          Food: 3500,
          Transport: 1000,
          Books: 1000,
          Rent: 6000,
          Entertainment: 800,
          Shopping: 1500,
          Health: 500,
          Other: 500,
        },
      },
    };
  }

  // demo account for first launch
  if (!read(USERS, null)) {
    write(USERS, [
      {
        name: "Aarav Sharma",
        email: "demo@student.com",
        password: "demo123",
        profile: {
          college: "Delhi University",
          course: "B.Sc Computer Science",
          year: "2nd Year",
          phone: "9876543210",
          city: "New Delhi",
        },
      },
    ]);
    write("set_data_demo@student.com", sampleData());
  }

  return {
    EXPENSE_CATS,
    INCOME_CATS,
    uid,
    users: () => read(USERS, []),
    saveUsers: (u) => write(USERS, u),
    session: () => read(SESSION, null),
    login: (email) => write(SESSION, email),
    logout: () => localStorage.removeItem(SESSION),
    currentUser() {
      const s = this.session();
      return this.users().find((u) => u.email === s) || null;
    },
    updateUser(patch) {
      const us = this.users();
      const i = us.findIndex((u) => u.email === this.session());
      if (i >= 0) {
        us[i] = {
          ...us[i],
          ...patch,
          profile: { ...us[i].profile, ...(patch.profile || {}) },
        };
        this.saveUsers(us);
      }
    },
    data() {
      const k = "set_data_" + this.session();
      let d = read(k, null);
      if (!d) {
        d = sampleData();
        write(k, d);
      }
      return d;
    },
    save(d) {
      write("set_data_" + this.session(), d);
    },
  };
})();

const fmt = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtDate = (s) =>
  new Date(s + "T00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

function toast(msg, type = "success") {
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    document.body.appendChild(box);
  }
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// Simple validator: rules = { fieldName: [fn(value) => errorMsg|null] }
function validate(form, rules) {
  let ok = true;
  for (const [name, checks] of Object.entries(rules)) {
    const el = form.elements[name];
    const field = el.closest(".field");
    let msg = null;
    for (const c of checks) {
      msg = c(el.value.trim());
      if (msg) break;
    }
    field.classList.toggle("invalid", !!msg);
    let e = field.querySelector(".err");
    if (!e) {
      e = document.createElement("div");
      e.className = "err";
      field.appendChild(e);
    }
    e.textContent = msg || "";
    if (msg) ok = false;
  }
  return ok;
}
const req = (label) => (v) => (v ? null : label + " is required");
const positive = (v) =>
  Number(v) > 0 ? null : "Enter an amount greater than 0";
const emailRule = (v) =>
  /^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email";
