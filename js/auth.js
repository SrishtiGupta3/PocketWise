
/* Login, registration, and student details */

document.addEventListener("DOMContentLoaded", () => {

  // ---------------- LOGIN ----------------

  const login = document.getElementById("loginForm");

  if (login) {
    login.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!validate(login, {
        email: [req("Email"), emailRule],
        password: [req("Password")],
      })) {
        return;
      }

      const email = login.email.value.trim().toLowerCase();
      const password = login.password.value;

      try {
        const { data, error } =
          await supabaseClient.auth.signInWithPassword({
            email,
            password,
          });

        if (error) {
          console.error("Login error:", error);
          return toast(error.message, "error");
        }

        // Check whether this user has completed their profile.
        const { data: profile, error: profileError } =
          await supabaseClient
            .from("profiles")
            .select("id")
            .eq("id", data.user.id)
            .maybeSingle();

        if (profileError) {
          console.error("Profile lookup error:", profileError);
          return toast(
            "Login succeeded, but the profile could not be checked.",
            "error"
          );
        }

        if (profile) {
          location.href = "app.html";
        } else {
          location.href = "details.html";
        }

      } catch (err) {
        console.error("Unexpected login error:", err);
        toast("Something went wrong. Please try again.", "error");
      }
    });
  }


  // ---------------- REGISTRATION ----------------

  const reg = document.getElementById("registerForm");

  if (reg) {
    reg.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!validate(reg, {
        name: [req("Full name")],
        email: [req("Email"), emailRule],
        password: [
          req("Password"),
          (v) => v.length >= 6 ? null : "At least 6 characters",
        ],
        confirm: [
          (v) =>
            v === reg.password.value
              ? null
              : "Passwords do not match",
        ],
      })) {
        return;
      }

      const name = reg.name.value.trim();
      const email = reg.email.value.trim().toLowerCase();
      const password = reg.password.value;

      try {
        const { data, error } =
          await supabaseClient.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name,
              },
              emailRedirectTo:
                "http://127.0.0.1:3000/register.html",
            },
          });

        if (error) {
          console.error("Signup error:", error);
          return toast(error.message, "error");
        }

        // Email confirmation may mean there is no session yet.
        if (!data.session) {
          toast(
            "Account created. Please confirm your email, then log in."
          );
          location.href = "index.html";
          return;
        }

        toast("Account created!");
        location.href = "details.html";

      } catch (err) {
        console.error("Unexpected signup error:", err);
        toast("Registration failed. Please try again.", "error");
      }
    });
  }


  // ---------------- STUDENT DETAILS ----------------

  const det = document.getElementById("detailsForm");

  if (det) {
    // Verify the real Supabase session, not Store.session().
    supabaseClient.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        location.href = "index.html";
      }
    });

    det.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!validate(det, {
        college: [req("College")],
        course: [req("Course")],
        year: [req("Year")],
        phone: [
          (v) =>
            /^\d{10}$/.test(v)
              ? null
              : "Enter a 10-digit phone number",
        ],
        budget: [positive],
      })) {
        return;
      }

      const f = Object.fromEntries(new FormData(det));

      try {
        const { data: userData, error: userError } =
          await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
          toast("Please log in again.", "error");
          location.href = "index.html";
          return;
        }

        const user = userData.user;

        // Save the student's profile in Supabase.
        const { error: profileError } =
          await supabaseClient
            .from("profiles")
            .upsert({
              id: user.id,
              full_name:
                user.user_metadata?.full_name || "",
              college: f.college,
              course: f.course,
              year: f.year,
              phone: f.phone,
              city: f.city || "",
            }, {
              onConflict: "id",
            });

        if (profileError) {
          console.error("Profile save error:", profileError);
          return toast(
            "Could not save your profile: " + profileError.message,
            "error"
          );
        }

        // Save the monthly budget in Supabase.
        const { error: budgetError } =
          await supabaseClient
            .from("budgets")
            .upsert({
              user_id: user.id,
              monthly_limit: Number(f.budget),
              category_limits: {},
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "user_id",
            });

        if (budgetError) {
          console.error("Budget save error:", budgetError);
          return toast(
            "Profile saved, but budget save failed: " +
              budgetError.message,
            "error"
          );
        }

        toast("Student details saved successfully!");

        // The dashboard still uses the older Store system.
        // This temporary line lets its existing session guard pass.
        // It does NOT move dashboard data into Supabase.
        Store.login(user.email);

        location.href = "app.html";

      } catch (err) {
        console.error("Unexpected details error:", err);
        toast("Could not save details. Please try again.", "error");
      }
    });
  }

});




