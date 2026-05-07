// ─────────────────────────────────────────────
// YOUNGVAULT - Main App Logic
// ─────────────────────────────────────────────

const API = 'http://localhost:3000';
let state = {
  token: localStorage.getItem('yv_token'),
  user: JSON.parse(localStorage.getItem('yv_user') || 'null'),
  vaults: [],
  transactions: []
};

// ─── UTILS ───
function $(id) { return document.getElementById(id); }

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = $(pageId);
  if (el) el.classList.add('active');
}

function showLoading(show = true) {
  $('loading-overlay').classList.toggle('hidden', !show);
}

function toast(msg, type = 'info', duration = 3500) {
  const container = $('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: '💡' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || '💡'}</span> ${msg}`;
  container.appendChild(t);
  setTimeout(() => { t.style.animation = 'slideIn 0.3s reverse'; setTimeout(() => t.remove(), 300); }, duration);
}

function fmt(amount) {
  return '₦' + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function apiFetch(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(API + endpoint, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── AUTH ───
async function register(e) {
  e.preventDefault();
  const fullName = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const phone = $('reg-phone').value.trim();
  const password = $('reg-password').value;
  if (!fullName || !email || !phone || !password) return toast('All fields required', 'error');
  if (password.length < 6) return toast('Password must be at least 6 characters', 'error');

  showLoading(true);
  try {
    const data = await apiFetch('/register', { method: 'POST', body: JSON.stringify({ fullName, email, phone, password }) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('yv_token', data.token);
    localStorage.setItem('yv_user', JSON.stringify(data.user));
    toast('Welcome to YoungVault! 🎉', 'success');
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function login(e) {
  e.preventDefault();
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  if (!email || !password) return toast('Email and password required', 'error');

  showLoading(true);
  try {
    const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('yv_token', data.token);
    localStorage.setItem('yv_user', JSON.stringify(data.user));
    toast(`Welcome back, ${data.user.fullName.split(' ')[0]}! 👋`, 'success');
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('yv_token');
  localStorage.removeItem('yv_user');
  showPage('page-landing');
}

// ─── DASHBOARD ───
async function loadDashboard() {
  if (!state.token) { showPage('page-landing'); return; }
  showLoading(true);
  try {
    const [balData, vaultData, txData] = await Promise.all([
      apiFetch('/balance'),
      apiFetch('/vaults'),
      apiFetch('/transactions')
    ]);
    state.user = { ...state.user, ...balData };
    state.vaults = vaultData.vaults;
    state.transactions = txData.transactions;
    localStorage.setItem('yv_user', JSON.stringify(state.user));
    renderDashboard();
    showPage('page-dashboard');
  } catch (err) {
    toast('Session expired. Please login again.', 'error');
    logout();
  } finally {
    showLoading(false);
  }
}

function renderDashboard() {
  const u = state.user;
  $('nav-user-name').textContent = u.fullName.split(' ')[0];
  $('nav-avatar').textContent = u.fullName[0].toUpperCase();
  $('dash-balance').textContent = fmt(u.balance);

  const lockedVaults = state.vaults.filter(v => v.status === 'locked');
  const totalLocked = lockedVaults.reduce((s, v) => s + v.amount, 0);
  const totalDeposited = state.transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);

  $('stat-locked').textContent = fmt(totalLocked);
  $('stat-vaults').textContent = lockedVaults.length;
  $('stat-deposited').textContent = fmt(totalDeposited);

  // Motivational messages
  const msgs = [
    { title: '🔥 Stay Disciplined!', text: 'Future you will thank you for every naira saved today.' },
    { title: '💎 Building Wealth', text: 'Small consistent savings today create massive wealth tomorrow.' },
    { title: '🎯 You\'re Doing Great!', text: 'Every vault you create is a promise to your future self.' },
    { title: '🚀 Keep Going!', text: 'Financial freedom is built one disciplined decision at a time.' }
  ];
  const msg = msgs[Math.floor(Math.random() * msgs.length)];
  $('motivational-text').innerHTML = `<strong>${msg.title}</strong>${msg.text}`;

  renderVaults();
  renderRecentTx();
  startCountdowns();
}

function renderVaults() {
  const container = $('vaults-container');
  if (!state.vaults.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏦</div><h3>No Vaults Yet</h3><p>Create your first locked savings vault to get started.</p></div>`;
    return;
  }
  container.innerHTML = state.vaults.map(vault => {
    const now = new Date();
    const unlock = new Date(vault.unlockDate);
    const created = new Date(vault.createdAt);
    const isLocked = vault.status === 'locked' && now < unlock;
    const isUnlocked = vault.status === 'locked' && now >= unlock;
    const isWithdrawn = vault.status === 'withdrawn';

    const totalDuration = unlock - created;
    const elapsed = now - created;
    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    let statusBadge = isLocked ? '<span class="badge badge-warning">🔒 Locked</span>' : isUnlocked ? '<span class="badge badge-success">🔓 Unlocked</span>' : '<span class="badge">✅ Withdrawn</span>';
    let action = '';
    if (isLocked) {
      action = `<div class="vault-countdown" id="countdown-${vault.id}"><strong>Calculating...</strong>Time remaining</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${progress.toFixed(1)}%"></div></div>`;
    } else if (isUnlocked) {
      action = `<button class="btn btn-primary btn-full btn-sm" onclick="withdrawVault('${vault.id}')">💰 Withdraw Now</button>`;
    } else {
      action = `<p style="color:var(--gray-400);font-size:13px;text-align:center">Withdrawn on ${fmtDate(vault.withdrawnAt)}</p>`;
    }

    return `<div class="vault-card ${isLocked ? 'locked' : isUnlocked ? 'unlocked' : 'withdrawn'}">
      <div class="vault-icon">${isWithdrawn ? '✅' : isUnlocked ? '🔓' : '🔒'}</div>
      <div class="vault-label">${vault.label}</div>
      <div class="vault-amount"><span>₦</span>${Number(vault.amount).toLocaleString()}</div>
      <div class="vault-meta">
        ${statusBadge}
        <span class="badge badge-blue">${vault.duration} month${vault.duration > 1 ? 's' : ''}</span>
      </div>
      <div style="font-size:12px;color:var(--gray-600);margin-bottom:8px">
        🗓️ Unlocks: ${fmtDate(vault.unlockDate)}
      </div>
      ${action}
    </div>`;
  }).join('');
}

function renderRecentTx() {
  const container = $('recent-tx');
  const recent = state.transactions.slice(0, 5);
  if (!recent.length) {
    container.innerHTML = `<div class="empty-state" style="padding:30px"><div class="empty-state-icon">📋</div><h3>No Transactions</h3></div>`;
    return;
  }
  container.innerHTML = recent.map(tx => txItem(tx)).join('');
}

function txItem(tx) {
  const icons = { deposit: { icon: '⬇️', cls: 'deposit' }, vault_lock: { icon: '🔒', cls: 'vault' }, vault_unlock: { icon: '🔓', cls: 'vault' }, withdrawal: { icon: '⬆️', cls: 'withdraw' } };
  const { icon, cls } = icons[tx.type] || { icon: '💸', cls: 'deposit' };
  const isPositive = ['deposit', 'vault_unlock'].includes(tx.type);
  return `<div class="tx-item">
    <div class="tx-icon ${cls}">${icon}</div>
    <div class="tx-info">
      <div class="tx-desc">${tx.description}</div>
      <div class="tx-date">${fmtDate(tx.createdAt)} · <span class="badge badge-success" style="font-size:11px;padding:2px 6px">${tx.status}</span></div>
    </div>
    <div class="tx-amount ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : '-'}${fmt(tx.amount)}</div>
  </div>`;
}

function startCountdowns() {
  state.vaults.forEach(vault => {
    const el = $(`countdown-${vault.id}`);
    if (!el) return;
    updateCountdown(vault, el);
    setInterval(() => updateCountdown(vault, el), 1000);
  });
}

function updateCountdown(vault, el) {
  const now = new Date();
  const unlock = new Date(vault.unlockDate);
  const diff = unlock - now;
  if (diff <= 0) { el.innerHTML = '<strong>🎉 Unlocked!</strong>Ready to withdraw'; return; }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  el.innerHTML = `<strong>${days}d ${hours}h ${mins}m ${secs}s</strong>Until unlock`;
}

// ─── DEPOSIT ───
async function handleDeposit(e) {
  e.preventDefault();
  const amount = parseFloat($('deposit-amount').value);
  if (!amount || amount < 100) return toast('Minimum deposit is ₦100', 'error');

  const method = document.querySelector('input[name="pay-method"]:checked')?.value || 'demo';

  if (method === 'paystack') {
    showLoading(true);
    try {
      const data = await apiFetch('/initialize-payment', { method: 'POST', body: JSON.stringify({ amount }) });
      window.open(data.authorizationUrl, '_blank');
      // After Paystack payment, user manually verifies
      toast('Complete payment in the Paystack window, then click "Verify Payment"', 'info', 6000);
      $('verify-reference').value = data.reference;
      $('verify-section').classList.remove('hidden');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      showLoading(false);
    }
  } else {
    // Demo mode
    showLoading(true);
    try {
      await apiFetch('/deposit', { method: 'POST', body: JSON.stringify({ amount, reference: `DEMO_${Date.now()}` }) });
      toast(`₦${amount.toLocaleString()} added to your wallet! 💰`, 'success');
      $('deposit-amount').value = '';
      await loadDashboard();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      showLoading(false);
    }
  }
}

async function verifyPayment() {
  const reference = $('verify-reference').value;
  const amount = parseFloat($('deposit-amount').value);
  showLoading(true);
  try {
    const data = await apiFetch('/verify-payment', { method: 'POST', body: JSON.stringify({ reference, amount }) });
    toast(`₦${data.amount?.toLocaleString() || amount.toLocaleString()} deposited successfully! 🎉`, 'success');
    $('verify-section').classList.add('hidden');
    await loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ─── VAULT ───
function openCreateVault() {
  $('vault-modal').classList.remove('hidden');
}

function closeVaultModal() {
  $('vault-modal').classList.add('hidden');
}

async function createVault(e) {
  e.preventDefault();
  const amount = parseFloat($('vault-amount').value);
  const duration = parseInt($('vault-duration').value);
  const label = $('vault-label').value.trim() || 'My Vault';

  if (!amount || amount < 500) return toast('Minimum vault amount is ₦500', 'error');
  if (!duration) return toast('Please select a duration', 'error');
  if (amount > state.user.balance) return toast('Insufficient balance', 'error');

  showLoading(true);
  try {
    await apiFetch('/create-vault', { method: 'POST', body: JSON.stringify({ amount, duration, label }) });
    toast(`Vault "${label}" created! 🔒 Stay disciplined!`, 'success');
    closeVaultModal();
    $('vault-amount').value = '';
    $('vault-label').value = '';
    await loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function withdrawVault(vaultId) {
  if (!confirm('Are you sure you want to withdraw from this vault?')) return;
  showLoading(true);
  try {
    const data = await apiFetch('/withdraw', { method: 'POST', body: JSON.stringify({ vaultId }) });
    toast(`${fmt(data.amount)} withdrawn to your wallet! 🎉`, 'success');
    await loadDashboard();
  } catch (err) {
    toast(err.message || 'Cannot withdraw yet', 'error');
  } finally {
    showLoading(false);
  }
}

// ─── TRANSACTIONS PAGE ───
async function loadTransactions() {
  if (!state.token) { showPage('page-landing'); return; }
  showLoading(true);
  try {
    const data = await apiFetch('/transactions');
    state.transactions = data.transactions;
    renderAllTransactions();
    showPage('page-transactions');
  } catch (err) {
    toast('Failed to load transactions', 'error');
  } finally {
    showLoading(false);
  }
}

function renderAllTransactions() {
  const container = $('all-tx');
  if (!state.transactions.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No Transactions Yet</h3><p>Make your first deposit to get started.</p></div>`;
    return;
  }
  container.innerHTML = state.transactions.map(tx => txItem(tx)).join('');
}

// ─── NAV ROUTING ───
function navigate(page) {
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'deposit': if (!state.token) { showPage('page-landing'); return; } showPage('page-deposit'); break;
    case 'transactions': loadTransactions(); break;
    case 'login': showPage('page-login'); break;
    case 'register': showPage('page-register'); break;
    case 'landing': showPage('page-landing'); break;
  }
  // Update nav active state
  document.querySelectorAll('.nav-link[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  if (state.token && state.user) {
    loadDashboard();
  } else {
    showPage('page-landing');
  }

  // Deposit quick amounts
  document.querySelectorAll('.quick-amount').forEach(btn => {
    btn.addEventListener('click', () => {
      $('deposit-amount').value = btn.dataset.amount;
    });
  });
});
