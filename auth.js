(() => {
  const $ = id => document.getElementById(id);
  const dialog = $("authDialog");
  const form = $("authForm");
  const nameField = $("authNameField");
  const passwordInput = $("authPassword");
  const message = $("authMessage");
  const config = window.BAZAAR_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey &&
    !config.url.includes("YOUR_PROJECT_REF") &&
    !config.anonKey.includes("YOUR_SUPABASE_ANON_KEY");
  const clientAvailable = window.supabase && typeof window.supabase.createClient === "function";
  let auth = null;
  let initializationError = null;
  if (configured && clientAvailable) {
    try {
      auth = window.supabase.createClient(config.url, config.anonKey).auth;
    } catch (error) {
      initializationError = error;
    }
  }
  let mode = "signin";
  let currentUser = null;

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function setMode(nextMode) {
    mode = nextMode;
    const signingUp = mode === "signup";
    $("authTitle").textContent = signingUp ? "Create your account" : "Sign in";
    $("authSubmit").textContent = signingUp ? "Create account" : "Sign in";
    $("authSwitchPrompt").textContent = signingUp ? "Already have an account?" : "New to Bazaar?";
    $("authSwitch").textContent = signingUp ? "Sign in" : "Create an account";
    nameField.hidden = !signingUp;
    $("authName").required = signingUp;
    passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
    setMessage("");
  }

  function renderAccount(user) {
    currentUser = user;
    $("accountBtn").textContent = user ? "My account" : "Sign in";
    $("accountBtn").title = user ? `Signed in as ${user.email}` : "Sign in or create an account";
    form.hidden = Boolean(user);
    $("authSwitch").parentElement.hidden = Boolean(user);
    $("authAccount").hidden = !user;
    if (user) $("authAccountEmail").textContent = user.email || "";
  }

  $("accountBtn").addEventListener("click", () => {
    renderAccount(currentUser);
    setMode("signin");
    if (!auth) {
      setMessage(initializationError
        ? `Supabase configuration could not be initialized: ${initializationError.message}`
        : clientAvailable
          ? "Add your Supabase project URL and anon key to supabase-config.js to enable authentication."
          : "Supabase could not be loaded. Check your connection and reload the page.", true);
    }
    dialog.showModal();
  });

  $("authClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  $("authSwitch").addEventListener("click", () => setMode(mode === "signin" ? "signup" : "signin"));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!auth) {
      setMessage(initializationError
        ? `Supabase configuration could not be initialized: ${initializationError.message}`
        : clientAvailable
          ? "Authentication is not configured yet. Add your Supabase project URL and anon key to supabase-config.js."
          : "Supabase could not be loaded. Check your connection and reload the page.", true);
      return;
    }

    const email = $("authEmailInput").value.trim();
    const password = passwordInput.value;
    const submit = $("authSubmit");
    submit.disabled = true;
    setMessage(mode === "signup" ? "Creating your account…" : "Signing in…");

    try {
      const result = mode === "signup"
        ? await auth.signUp({
          email,
          password,
          options: { data: { display_name: $("authName").value.trim() } }
        })
        : await auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        setMessage("Account created. Check your email for a confirmation link before signing in.");
        form.reset();
        return;
      }

      renderAccount(result.data.user);
      dialog.close();
      form.reset();
    } catch (error) {
      setMessage(error.message || "Authentication failed. Please try again.", true);
    } finally {
      submit.disabled = false;
    }
  });

  $("authSignOut").addEventListener("click", async () => {
    if (!auth) return;
    const signOut = $("authSignOut");
    signOut.disabled = true;
    try {
      const { error } = await auth.signOut();
      if (error) throw error;
      renderAccount(null);
      dialog.close();
    } catch (error) {
      setMessage(error.message || "Could not sign out. Please try again.", true);
    } finally {
      signOut.disabled = false;
    }
  });

  setMode("signin");
  if (auth) {
    auth.getUser().then(({ data, error }) => {
      if (error) throw error;
      renderAccount(data.user);
    }).catch(error => {
      setMessage(error.message || "Could not restore your sign-in session.", true);
    });

    auth.onAuthStateChange((_event, session) => {
      renderAccount(session && session.user);
    });
  }
})();
