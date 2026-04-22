const api = {
  async request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "Произошла ошибка.");
    }
    return data;
  },
  session() {
    return this.request("/api/session", { method: "GET" });
  },
  login(payload) {
    return this.request("/api/login", { method: "POST", body: JSON.stringify(payload) });
  },
  register(payload) {
    return this.request("/api/register", { method: "POST", body: JSON.stringify(payload) });
  },
  logout() {
    return this.request("/api/logout", { method: "POST", body: "{}" });
  },
  updateName(display_name) {
    return this.request("/api/profile/name", {
      method: "PATCH",
      body: JSON.stringify({ display_name }),
    });
  },
  updatePassword(current_password, new_password) {
    return this.request("/api/profile/password", {
      method: "PATCH",
      body: JSON.stringify({ current_password, new_password }),
    });
  },
  updatePreferences(theme) {
    return this.request("/api/profile/preferences", {
      method: "PATCH",
      body: JSON.stringify({ theme }),
    });
  },
  uploadAvatar(image_data) {
    return this.request("/api/profile/avatar", {
      method: "POST",
      body: JSON.stringify({ image_data }),
    });
  },
  uploadBackground(image_data) {
    return this.request("/api/profile/background", {
      method: "POST",
      body: JSON.stringify({ image_data }),
    });
  },
  resetBackground() {
    return this.request("/api/profile/background", { method: "DELETE" });
  },
  purchase(product_id, promo_code = "") {
    return this.request("/api/store/purchase", {
      method: "POST",
      body: JSON.stringify({ product_id, promo_code }),
    });
  },
};

const PRODUCTS = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 299,
    description: "Базовый доступ к Sonya AI для первых сценариев удалённого управления.",
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 890,
    description: "Расширенный формат для регулярной работы с Sonya AI и более гибкого сценария использования.",
  },
  ultimate: {
    id: "ultimate",
    name: "Ultimate",
    price: 1499,
    description: "Максимальный пакет с полным доступом и приоритетным форматом использования Sonya AI.",
  },
};

const icons = {
  user: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12.3a4.15 4.15 0 1 0 0-8.3 4.15 4.15 0 0 0 0 8.3Z"></path>
      <path d="M4.75 19.2a7.5 7.5 0 0 1 14.5 0"></path>
    </svg>
  `,
  cash: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="7" width="14" height="10" rx="2"></rect>
      <path d="M7 5.5h12a1.5 1.5 0 0 1 1.5 1.5v8"></path>
      <circle cx="11" cy="12" r="2.1"></circle>
    </svg>
  `,
  logout: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5.75H6.75A1.75 1.75 0 0 0 5 7.5v9a1.75 1.75 0 0 0 1.75 1.75H10"></path>
      <path d="M13 8.5 17 12l-4 3.5"></path>
      <path d="M17 12H9"></path>
    </svg>
  `,
  lock: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5.5" y="10" width="13" height="9" rx="2.2"></rect>
      <path d="M8.5 10V7.8a3.5 3.5 0 1 1 7 0V10"></path>
    </svg>
  `,
  wand: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 19 8.8-8.8"></path>
      <path d="m12.2 6.2 1.6-1.6 5.6 5.6-1.6 1.6"></path>
      <path d="M7 7.5h.01M16.5 4.5h.01M18.5 14.5h.01"></path>
    </svg>
  `,
  download: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.75v9"></path>
      <path d="m8.75 10.75 3.25 3.5 3.25-3.5"></path>
      <path d="M5.5 18.25h13"></path>
    </svg>
  `,
  check: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7.5 12.5 3 3 6-6"></path>
    </svg>
  `,
};

const state = {
  currentPage: "about",
  user: null,
};

const loadingScreen = document.getElementById("loadingScreen");
const overlayLayer = document.getElementById("overlayLayer");
const authModal = document.getElementById("authModal");
const bubbleModal = document.getElementById("bubbleModal");
const bubbleCard = document.getElementById("bubbleCard");
const toastStack = document.getElementById("toastStack");
const authStatus = document.getElementById("authStatus");
const themeToggle = document.getElementById("themeToggle");
const brandLink = document.querySelector(".brand");
const navLinks = document.querySelectorAll("[data-nav-link]");
const guestActions = document.getElementById("guestActions");
const profileToolbar = document.getElementById("profileToolbar");
const profileMenuToggle = document.getElementById("profileMenuToggle");
const profileDropdown = document.getElementById("profileDropdown");
const toolbarDisplayName = document.getElementById("toolbarDisplayName");
const toolbarRole = document.getElementById("toolbarRole");
const toolbarAvatar = document.getElementById("toolbarAvatar");
const toolbarAvatarImage = document.getElementById("toolbarAvatarImage");
const buyButton = document.getElementById("buyButton");
const pageViews = document.querySelectorAll("[data-page]");
const revealElements = document.querySelectorAll(".reveal-on-scroll");
const typeTargets = document.querySelectorAll("[data-type-target]");
const closeAuthModalButton = document.getElementById("closeAuthModal");
const authTabs = document.querySelectorAll("[data-auth-tab]");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const accountDisplayName = document.getElementById("accountDisplayName");
const accountLogin = document.getElementById("accountLogin");
const accountStatus = document.getElementById("accountStatus");
const accountBalance = document.getElementById("accountBalance");
const purchaseList = document.getElementById("purchaseList");
const accountAdminFlag = document.getElementById("accountAdminFlag");
const avatarShell = document.querySelector(".avatar-shell");
const accountAvatarImage = document.getElementById("accountAvatarImage");
const accountAvatarFallback = document.getElementById("accountAvatarFallback");
const changeAvatarButton = document.getElementById("changeAvatarButton");
const avatarInput = document.getElementById("avatarInput");
const logoutFromAccount = document.getElementById("logoutFromAccount");
const purchaseButtons = document.querySelectorAll("[data-purchase-product]");

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function setOverlay(visible) {
  overlayLayer.classList.toggle("hidden", !visible);
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
}

function setBackgroundImage(url) {
  document.documentElement.style.setProperty(
    "--page-background-image",
    url ? `url("${url}")` : "var(--default-background-image)"
  );
}

function firstLetter(value) {
  return (value || "S").trim().charAt(0).toUpperCase() || "S";
}

function formatBalance(value) {
  return `${value} ₽`;
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function showLoaderNow() {
  loadingScreen.classList.remove("is-hidden", "is-hiding");
  loadingScreen.classList.add("is-animating");
  void loadingScreen.offsetWidth;
}

async function hideLoaderNow() {
  loadingScreen.classList.add("is-hiding");
  await wait(420);
  loadingScreen.classList.add("is-hidden");
  loadingScreen.classList.remove("is-hiding", "is-animating");
}

function applyActiveLink(pageName) {
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.navLink === pageName);
  });
}

function setActivePage(pageName) {
  state.currentPage = pageName;
  pageViews.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.page === pageName);
  });

  if (pageName === "account") {
    navLinks.forEach((link) => link.classList.remove("is-active"));
  } else {
    applyActiveLink(pageName);
  }
}

function revealPage(pageName) {
  document.querySelectorAll(`[data-page="${pageName}"] .reveal-on-scroll`).forEach((element, index) => {
    window.setTimeout(() => element.classList.add("is-visible"), 85 * index);
  });
}

function hidePageReveal(pageName) {
  document.querySelectorAll(`[data-page="${pageName}"] .reveal-on-scroll`).forEach((element) => {
    element.classList.remove("is-visible");
  });
}

function scrollToTopSmooth() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideStats() {
  typeTargets.forEach((element) => {
    element.classList.remove("is-visible");
  });
}

function animateStats() {
  typeTargets.forEach((element) => {
    element.textContent = element.dataset.typeTarget || "";
  });
  window.setTimeout(() => {
    typeTargets.forEach((element) => element.classList.add("is-visible"));
  }, 220);
}

function showToast(title, message) {
  const toast = document.createElement("article");
  toast.className = "toast";
  toast.innerHTML = `
    <button class="toast-close" type="button" aria-label="Закрыть">×</button>
    <div class="toast-body">
      <strong class="toast-title">${title}</strong>
      <span class="toast-message">${message}</span>
    </div>
    <div class="toast-progress"></div>
  `;

  toastStack.appendChild(toast);
  window.requestAnimationFrame(() => toast.classList.add("is-visible"));

  const removeToast = () => {
    toast.classList.remove("is-visible");
    toast.classList.add("is-hiding");
    window.setTimeout(() => toast.remove(), 320);
  };

  const timer = window.setTimeout(removeToast, 2500);
  toast.querySelector(".toast-close")?.addEventListener("click", () => {
    window.clearTimeout(timer);
    removeToast();
  });
}

function renderMenuIcons() {
  document.querySelectorAll("[data-profile-action='account']").forEach((button) => {
    button.innerHTML = `<span class="menu-icon">${icons.user}</span><span>Аккаунт</span>`;
  });
  document.querySelectorAll("[data-profile-action='topup']").forEach((button) => {
    button.innerHTML = `<span class="menu-icon">${icons.cash}</span><span>Пополнить</span>`;
  });
  document.querySelectorAll("[data-profile-action='logout']").forEach((button) => {
    button.innerHTML = `<span class="menu-icon">${icons.logout}</span><span>Выйти</span>`;
  });

  document.querySelectorAll("[data-bubble='name']").forEach((button) => {
    const icon = button.querySelector(".account-action-icon");
    if (icon) icon.innerHTML = icons.user;
  });
  document.querySelectorAll("[data-bubble='password']").forEach((button) => {
    const icon = button.querySelector(".account-action-icon");
    if (icon) icon.innerHTML = icons.lock;
  });
  document.querySelectorAll("[data-bubble='customize']").forEach((button) => {
    const icon = button.querySelector(".account-action-icon");
    if (icon) icon.innerHTML = icons.wand;
  });
  document.querySelectorAll("[data-bubble='topup']").forEach((button) => {
    const icon = button.querySelector(".account-action-icon");
    if (icon) icon.innerHTML = icons.cash;
  });
  document.querySelectorAll("#logoutFromAccount").forEach((button) => {
    const icon = button.querySelector(".account-action-icon");
    if (icon) icon.innerHTML = icons.logout;
  });
}

function renderPurchases() {
  const purchases = state.user?.purchases || [];

  if (!purchaseList) return;

  if (purchases.length === 0) {
    purchaseList.innerHTML = `
      <article class="purchase-empty">
        <strong>Покупок пока нет</strong>
        <p>После приобретения тарифа он появится здесь вместе с датой покупки и кнопкой установки.</p>
      </article>
    `;
    return;
  }

  purchaseList.innerHTML = purchases
    .map(
      (purchase) => `
        <article class="purchase-item">
          <div class="purchase-item-head">
            <div class="purchase-item-title">
              <strong>${purchase.product_name}</strong>
              <span>${formatDateTime(purchase.purchased_at)}</span>
            </div>
            <span class="purchase-meta">${purchase.price} ₽</span>
          </div>
          <p>${purchase.description}</p>
          <div class="purchase-item-footer">
            <span class="purchase-meta">Тариф оформлен</span>
            <button class="purchase-download" data-download-product="${purchase.product_id}" type="button">
              <span class="download-icon">${icons.download}</span>
              <span>Скачать</span>
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderUser() {
  const user = state.user;
  guestActions.classList.toggle("hidden", Boolean(user));
  profileToolbar.classList.toggle("hidden", !user);

  if (!user) {
    toolbarDisplayName.textContent = "Sonya";
    toolbarRole.textContent = "ADMIN";
    toolbarRole.classList.add("hidden");
    profileMenuToggle?.classList.remove("is-admin");
    toolbarAvatar.textContent = "S";
    toolbarAvatar.classList.remove("hidden");
    toolbarAvatarImage.classList.add("hidden");
    toolbarAvatarImage.removeAttribute("src");

    accountDisplayName.textContent = "Sonya";
    accountLogin.textContent = "@guest";
    accountStatus.textContent = "";
    accountBalance.textContent = "0 ₽";
    accountAvatarFallback.textContent = "S";
    accountAvatarFallback.classList.remove("hidden");
    accountAvatarImage.classList.add("hidden");
    accountAvatarImage.removeAttribute("src");
    avatarShell?.classList.remove("is-admin");
    accountAdminFlag?.classList.add("hidden");
    renderPurchases();
    setTheme("dark");
    setBackgroundImage(null);
    return;
  }

  const displayName = user.display_name || user.login || "Sonya";
  const avatarLetter = firstLetter(displayName);
  const isAdmin = user.role === "admin";

  toolbarDisplayName.textContent = displayName;
  toolbarRole.textContent = "ADMIN";
  toolbarRole.classList.toggle("hidden", !isAdmin);
  profileMenuToggle?.classList.toggle("is-admin", isAdmin);
  toolbarAvatar.textContent = avatarLetter;
  accountDisplayName.textContent = displayName;
  accountLogin.textContent = `@${user.login}`;
  accountStatus.textContent = isAdmin ? "ADMIN" : "";
  accountBalance.textContent = formatBalance(user.balance || 0);
  accountAvatarFallback.textContent = avatarLetter;
  avatarShell?.classList.toggle("is-admin", isAdmin);
  accountAdminFlag?.classList.toggle("hidden", !isAdmin);

  if (user.avatar_url) {
    toolbarAvatarImage.src = user.avatar_url;
    toolbarAvatarImage.classList.remove("hidden");
    toolbarAvatar.classList.add("hidden");

    accountAvatarImage.src = user.avatar_url;
    accountAvatarImage.classList.remove("hidden");
    accountAvatarFallback.classList.add("hidden");
  } else {
    toolbarAvatarImage.classList.add("hidden");
    toolbarAvatarImage.removeAttribute("src");
    toolbarAvatar.classList.remove("hidden");

    accountAvatarImage.classList.add("hidden");
    accountAvatarImage.removeAttribute("src");
    accountAvatarFallback.classList.remove("hidden");
  }

  setTheme(user.theme || "dark");
  setBackgroundImage(user.background_image || null);
  renderPurchases();
}

function openProfileDropdown() {
  profileDropdown.classList.remove("hidden");
  window.requestAnimationFrame(() => {
    profileDropdown.classList.add("is-open");
    profileMenuToggle.classList.add("is-open");
  });
}

function closeProfileDropdown() {
  if (profileDropdown.classList.contains("hidden")) return;
  profileDropdown.classList.remove("is-open");
  profileMenuToggle.classList.remove("is-open");
  window.setTimeout(() => profileDropdown.classList.add("hidden"), 240);
}

function openAuthModal(tabName) {
  authStatus.textContent = "";
  authTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.authTab === tabName));
  loginForm.classList.toggle("is-active", tabName === "login");
  registerForm.classList.toggle("is-active", tabName === "register");

  authModal.classList.remove("hidden", "is-closing");
  setOverlay(true);
  window.requestAnimationFrame(() => authModal.classList.add("is-open"));
}

async function closeAuthModalUi() {
  if (authModal.classList.contains("hidden")) return;
  authModal.classList.remove("is-open");
  authModal.classList.add("is-closing");
  await wait(180);
  authModal.classList.add("hidden");
  authModal.classList.remove("is-closing");
  if (bubbleModal.classList.contains("hidden")) {
    setOverlay(false);
  }
}

function openBubble(html) {
  bubbleCard.innerHTML = html;
  bubbleModal.classList.remove("hidden", "is-closing");
  setOverlay(true);
  window.requestAnimationFrame(() => bubbleModal.classList.add("is-open"));
}

async function closeBubble() {
  if (bubbleModal.classList.contains("hidden")) return;
  bubbleModal.classList.remove("is-open");
  bubbleModal.classList.add("is-closing");
  await wait(180);
  bubbleModal.classList.add("hidden");
  bubbleModal.classList.remove("is-closing");
  if (authModal.classList.contains("hidden")) {
    setOverlay(false);
  }
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function playLoaderTransition(pageName, { force = false } = {}) {
  if (!force && state.currentPage === pageName) {
    scrollToTopSmooth();
    return;
  }

  showLoaderNow();
  await wait(520);
  hidePageReveal(pageName);
  setActivePage(pageName);
  window.scrollTo({ top: 0, behavior: "auto" });
  revealPage(pageName);
  await wait(520);
  await hideLoaderNow();
}

async function performLogout() {
  showLoaderNow();
  closeProfileDropdown();
  await closeBubble();
  await closeAuthModalUi();
  await api.logout().catch(() => null);
  state.user = null;
  renderUser();
  hidePageReveal("about");
  setActivePage("about");
  window.scrollTo({ top: 0, behavior: "auto" });
  revealPage("about");
  await wait(560);
  await hideLoaderNow();
}

function nameModal() {
  return `
    <button class="modal-close" data-close-bubble type="button" aria-label="Закрыть">×</button>
    <form class="bubble-form" id="changeNameForm">
      <h3>Изменить имя</h3>
      <p>Обновите отображаемое имя профиля.</p>
      <label class="field">
        <span>Новое имя</span>
        <input type="text" name="display_name" value="${state.user?.display_name || ""}" required>
      </label>
      <button class="primary-action" type="submit">Сохранить</button>
      <p class="form-status" id="nameStatus"></p>
    </form>
  `;
}

function passwordModal() {
  return `
    <button class="modal-close" data-close-bubble type="button" aria-label="Закрыть">×</button>
    <form class="bubble-form" id="changePasswordForm">
      <h3>Сменить пароль</h3>
      <p>Введите текущий пароль и новый пароль.</p>
      <label class="field">
        <span>Текущий пароль</span>
        <input type="password" name="current_password" required>
      </label>
      <label class="field">
        <span>Новый пароль</span>
        <input type="password" name="new_password" required>
      </label>
      <button class="primary-action" type="submit">Обновить пароль</button>
      <p class="form-status" id="passwordStatus"></p>
    </form>
  `;
}

function topupModal() {
  return `
    <button class="modal-close" data-close-bubble type="button" aria-label="Закрыть">×</button>
    <div class="bubble-form">
      <h3>Пополнить</h3>
      <p>Эта функция пока временно неактивна, но позже здесь появится пополнение баланса.</p>
      <button class="secondary-action" data-close-bubble type="button">Закрыть</button>
    </div>
  `;
}

function customizationModal() {
  const isDark = (state.user?.theme || "dark") === "dark";
  return `
    <button class="modal-close" data-close-bubble type="button" aria-label="Закрыть">×</button>
    <div class="bubble-form">
      <h3>Кастомизация</h3>
      <p>Смените тему, установите свой фон или верните стандартный вид сайта.</p>
      <div class="toggle-row">
        <div>
          <strong>Тёмная тема</strong>
          <p>Мягкий тёмный интерфейс</p>
        </div>
        <button class="switch ${isDark ? "is-active" : ""}" id="themeSwitch" type="button"></button>
      </div>
      <label class="upload-area" for="backgroundInput">
        <input class="hidden-file-input" id="backgroundInput" type="file" accept="image/*">
        <strong>Фон сайта</strong>
        <span>Нажмите, чтобы выбрать изображение</span>
      </label>
      <button class="secondary-action" id="resetCustomization" type="button">Сбросить</button>
      <p class="form-status" id="customizationStatus"></p>
    </div>
  `;
}

function purchaseModal(productId) {
  const product = PRODUCTS[productId];
  if (!product) return "";
  return `
    <button class="modal-close" data-close-bubble type="button" aria-label="Закрыть">×</button>
    <form class="bubble-form" id="purchaseForm" data-product-id="${product.id}">
      <h3>Корзина</h3>
      <p>Проверьте выбранный товар перед покупкой.</p>
      <div class="purchase-item">
        <div class="purchase-item-head">
          <div class="purchase-item-title">
            <strong>${product.name}</strong>
            <span>Тариф Sonya AI</span>
          </div>
          <span class="purchase-meta" id="purchasePriceMeta">${product.price} ₽</span>
        </div>
        <p>${product.description}</p>
      </div>
      <label class="field promo-field" id="promoField">
        <span>Промокод</span>
        <div class="promo-input-wrap">
          <input type="text" name="promo_code" id="promoCodeInput" placeholder="Если есть — введите сюда" autocomplete="off">
          <button class="promo-apply hidden" id="promoApplyButton" type="button" aria-label="Применить промокод">${icons.check}</button>
        </div>
      </label>
      <button class="primary-action" type="submit">Купить</button>
      <p class="form-status" id="purchaseStatus"></p>
    </form>
  `;
}

async function handleAuthSuccess(user) {
  showLoaderNow();
  state.user = user;
  renderUser();
  await closeAuthModalUi();
  closeProfileDropdown();
  hidePageReveal("about");
  setActivePage("about");
  window.scrollTo({ top: 0, behavior: "auto" });
  revealPage("about");
  await wait(560);
  await hideLoaderNow();
}

document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", () => openAuthModal(button.dataset.openAuth));
});

closeAuthModalButton?.addEventListener("click", () => closeAuthModalUi());

authModal.addEventListener("click", (event) => {
  if (event.target === authModal) {
    closeAuthModalUi();
  }
});

overlayLayer.addEventListener("click", () => {
  closeAuthModalUi();
  closeBubble();
  closeProfileDropdown();
});

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => openAuthModal(tab.dataset.authTab));
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  authStatus.textContent = "";
  try {
    const result = await api.login({
      login: String(data.get("login") || ""),
      password: String(data.get("password") || ""),
    });
    loginForm.reset();
    await handleAuthSuccess(result.user);
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(registerForm);
  authStatus.textContent = "";
  try {
    const result = await api.register({
      login: String(data.get("login") || ""),
      password: String(data.get("password") || ""),
    });
    registerForm.reset();
    await handleAuthSuccess(result.user);
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

themeToggle?.addEventListener("click", async () => {
  const nextTheme = document.body.dataset.theme === "light" ? "dark" : "light";
  setTheme(nextTheme);
  if (!state.user) return;
  try {
    const result = await api.updatePreferences(nextTheme);
    state.user = result.user;
    renderUser();
  } catch {
    setTheme(state.user.theme || "dark");
  }
});

navLinks.forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    await playLoaderTransition(link.dataset.navLink);
  });
});

brandLink?.addEventListener("click", async (event) => {
  event.preventDefault();
  if (state.currentPage === "about") {
    scrollToTopSmooth();
    return;
  }
  await playLoaderTransition("about");
});

buyButton?.addEventListener("click", async () => {
  await playLoaderTransition("store");
});

purchaseButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!state.user) {
      openAuthModal("login");
      showToast("Нужен аккаунт", "Сначала войдите или зарегистрируйтесь, чтобы оформить покупку.");
      return;
    }
    openBubble(purchaseModal(button.dataset.purchaseProduct));
  });
});

profileMenuToggle?.addEventListener("click", () => {
  if (profileDropdown.classList.contains("hidden")) {
    openProfileDropdown();
    return;
  }
  closeProfileDropdown();
});

document.querySelectorAll("[data-profile-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    closeProfileDropdown();
    const action = button.dataset.profileAction;

    if (action === "account") {
      await playLoaderTransition("account", { force: true });
      return;
    }
    if (action === "topup") {
      openBubble(topupModal());
      return;
    }
    if (action === "logout") {
      await performLogout();
    }
  });
});

document.querySelectorAll("[data-bubble]").forEach((button) => {
  button.addEventListener("click", () => {
    const bubble = button.dataset.bubble;
    if (bubble === "name") openBubble(nameModal());
    if (bubble === "password") openBubble(passwordModal());
    if (bubble === "customize") openBubble(customizationModal());
    if (bubble === "topup") openBubble(topupModal());
  });
});

bubbleModal.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target === bubbleModal || target.dataset.closeBubble !== undefined) {
    closeBubble();
  }
});

bubbleCard.addEventListener("submit", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;

  if (target.id === "changeNameForm") {
    event.preventDefault();
    const formData = new FormData(target);
    const status = document.getElementById("nameStatus");
    try {
      const result = await api.updateName(String(formData.get("display_name") || ""));
      state.user = result.user;
      renderUser();
      await closeBubble();
      showToast("Имя обновлено", "Новое отображаемое имя сохранено.");
    } catch (error) {
      status.textContent = error.message;
    }
  }

  if (target.id === "changePasswordForm") {
    event.preventDefault();
    const formData = new FormData(target);
    const status = document.getElementById("passwordStatus");
    try {
      await api.updatePassword(
        String(formData.get("current_password") || ""),
        String(formData.get("new_password") || "")
      );
      target.reset();
      await closeBubble();
      showToast("Пароль обновлён", "Изменения безопасности успешно применены.");
    } catch (error) {
      status.textContent = error.message;
    }
  }

  if (target.id === "purchaseForm") {
    event.preventDefault();
    const formData = new FormData(target);
    const status = document.getElementById("purchaseStatus");
    try {
      const result = await api.purchase(
        target.dataset.productId,
        String(formData.get("promo_code") || "")
      );
      state.user = result.user;
      renderUser();
      await closeBubble();
      showToast("Покупка завершена", "Тариф успешно оформлен. Перейдите в аккаунт для установки приложения.");
    } catch (error) {
      const message = error.message || "";
      if (message.toLowerCase().includes("недостаточно")) {
        showToast("Недостаточно средств", "На балансе не хватает денег для покупки выбранного тарифа.");
      } else {
        status.textContent = message;
      }
    }
  }
});

bubbleCard.addEventListener("click", async (event) => {
  const rawTarget = event.target;
  if (!(rawTarget instanceof Element)) return;
  const target = rawTarget.closest("#themeSwitch, #resetCustomization, #promoApplyButton");
  if (!(target instanceof Element)) return;

  if (target.id === "themeSwitch") {
    const nextTheme = target.classList.contains("is-active") ? "light" : "dark";
    const status = document.getElementById("customizationStatus");
    try {
      const result = await api.updatePreferences(nextTheme);
      state.user = result.user;
      renderUser();
      target.classList.toggle("is-active", nextTheme === "dark");
      showToast(
        "Тема изменена",
        nextTheme === "dark" ? "Тёмная тема включена." : "Светлая тема включена."
      );
    } catch (error) {
      status.textContent = error.message;
    }
  }

  if (target.id === "resetCustomization") {
    const status = document.getElementById("customizationStatus");
    try {
      await api.resetBackground();
      const result = await api.updatePreferences("dark");
      state.user = result.user;
      renderUser();
      await closeBubble();
      showToast("Настройки сброшены", "Тема и фон возвращены к стандартному виду.");
    } catch (error) {
      status.textContent = error.message;
    }
  }

  if (target.id === "promoApplyButton") {
    const form = target.closest("#purchaseForm");
    const input = document.getElementById("promoCodeInput");
    const status = document.getElementById("purchaseStatus");
    const promoField = document.getElementById("promoField");
    const priceMeta = document.getElementById("purchasePriceMeta");
    if (!form || !input || !promoField || !priceMeta) return;

    try {
      const result = await api.request("/api/store/promo/validate", {
        method: "POST",
        body: JSON.stringify({
          code: input.value.trim(),
          product_id: form.dataset.productId,
        }),
      });
      promoField.classList.add("is-applied");
      input.readOnly = true;
      priceMeta.innerHTML = `<span class="price-stack"><span class="old-price">${PRODUCTS[form.dataset.productId].price} ₽</span><span class="new-price">${result.promo.discounted_price} ₽</span></span>`;
      status.textContent = "";
    } catch (error) {
      status.textContent = "";
      showToast("Промокод недействителен", error.message || "Промокод не существует или его срок действия истёк.");
    }
  }
});

bubbleCard.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.id === "backgroundInput" && target.files?.[0]) {
    const status = document.getElementById("customizationStatus");
    try {
      const imageData = await readFileAsDataUrl(target.files[0]);
      const result = await api.uploadBackground(imageData);
      state.user = result.user;
      renderUser();
      await closeBubble();
      showToast("Фон обновлён", "Новое изображение фона успешно сохранено.");
    } catch (error) {
      status.textContent = error.message;
    }
  }
});

bubbleCard.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.id === "promoCodeInput") {
    const applyButton = document.getElementById("promoApplyButton");
    const promoField = document.getElementById("promoField");
    const priceMeta = document.getElementById("purchasePriceMeta");
    const form = target.closest("#purchaseForm");
    if (!applyButton || !promoField || !priceMeta || !form) return;

    applyButton.classList.toggle("hidden", target.value.trim().length === 0);
    promoField.classList.remove("is-applied");
    target.readOnly = false;
    priceMeta.textContent = `${PRODUCTS[form.dataset.productId].price} ₽`;
  }
});

bubbleCard.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id === "promoCodeInput") {
    const promoField = document.getElementById("promoField");
    if (promoField?.classList.contains("is-applied")) {
      promoField.classList.remove("is-applied");
      target.readOnly = false;
    }
  }
});

changeAvatarButton?.addEventListener("click", () => avatarInput.click());

avatarInput?.addEventListener("change", async () => {
  if (!avatarInput.files?.[0]) return;
  try {
    const imageData = await readFileAsDataUrl(avatarInput.files[0]);
    const result = await api.uploadAvatar(imageData);
    state.user = result.user;
    renderUser();
    showToast("Аватар обновлён", "Новая аватарка уже видна в профиле и в тулбаре.");
  } catch {
    showToast("Не удалось обновить", "Попробуйте выбрать другое изображение.");
  } finally {
    avatarInput.value = "";
  }
});

logoutFromAccount?.addEventListener("click", async () => {
  await performLogout();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (!profileToolbar.contains(target)) {
    closeProfileDropdown();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest("[data-download-product]")) {
    showToast("Скачивание скоро", "Кнопка установки появится позже. Покупка уже сохранена в вашем аккаунте.");
  }
});

bubbleCard.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target === bubbleCard || target.classList.contains("bubble-form") || target.classList.contains("bubble-card")) {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }
});

if (revealElements.length > 0) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
  );
  revealElements.forEach((element) => revealObserver.observe(element));
}

async function bootstrap() {
  try {
    const session = await api.session();
    state.user = session.user;
  } catch {
    state.user = null;
  }

  renderUser();
  renderMenuIcons();
  setTheme(state.user?.theme || "dark");
  revealPage("about");
  hideStats();

  window.setTimeout(() => {
    loadingScreen.classList.add("is-hiding");
    window.setTimeout(() => {
      loadingScreen.classList.add("is-hidden");
      loadingScreen.classList.remove("is-hiding", "is-animating");
      animateStats();
    }, 700);
  }, 2100);
}

bootstrap();
