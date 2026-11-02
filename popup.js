// popup.js
// ==================== CONFIGURATION ====================
// Replace API_BASE_URL with your deployed Replit app URL after publishing
const API_BASE_URL = 'https://your-app.replit.app/api';

// Plans: Free ($0), Monthly ($9/mo), Yearly ($99/yr), Pro Lifetime ($49 one-time)
const STRIPE_LINKS = {
  monthly: 'https://buy.stripe.com/your-monthly-link',    // REPLACE: $9/month
  yearly: 'https://buy.stripe.com/your-yearly-link',      // REPLACE: $99/year
  lifetime: 'https://buy.stripe.com/your-earlybird-link'  // REPLACE: $49 one-time (Pro Lifetime)
};

const EARLY_BIRD_TOTAL = 100;
const FREE_VISIBLE_COUNT = 3;

// ==================== GLOBALS ====================
let isPro = false;
let currentEmail = '';
let scanning = false;
let earlyBirdRemaining = 0;
let userFollowerCount = 0;
let lastUnfollowers = [];

const scanBtn = document.getElementById('scanBtn');
const stopBtn = document.getElementById('stopBtn');
const upgradeBtn = document.getElementById('upgradeBtn');
const statusDiv = document.getElementById('statusText');
const resultBox = document.getElementById('resultBox');
const countSpan = document.getElementById('count');
const unfollowListDiv = document.getElementById('unfollowList');
const maxLimitSelect = document.getElementById('maxLimitSelect');
const proBadge = document.getElementById('proBadge');
const earlyBirdNotice = document.getElementById('earlyBirdNotice');

// ==================== HELPERS ====================
function showStatus(msg) {
  statusDiv.innerText = msg;
}

async function sendToContent(tabId, message, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
    setTimeout(() => reject(new Error('Timeout — scan took too long')), timeoutMs);
  });
}

async function getUserEmail() {
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo((userInfo) => {
      resolve(userInfo?.email ?? '');
    });
  });
}

// ==================== API CALLS ====================
async function checkProStatus(email) {
  if (!email) return { isPro: false };
  try {
    const res = await fetch(`${API_BASE_URL}/pro/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch (err) {
    console.error('Pro check failed:', err);
    return { isPro: false };
  }
}

async function fetchEarlyBirdRemaining() {
  try {
    const res = await fetch(`${API_BASE_URL}/pro/early-bird`);
    const data = await res.json();
    return data.remaining ?? 0;
  } catch {
    return 0;
  }
}

// ==================== STORAGE ====================
async function getStoredList() {
  return new Promise((resolve) => {
    chrome.storage.local.get('previousList', (data) => {
      resolve(data.previousList ?? []);
    });
  });
}

async function saveList(list) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ previousList: list }, resolve);
  });
}

// ==================== UI ====================
function updateUpgradeButton() {
  if (earlyBirdRemaining > 0) {
    upgradeBtn.textContent = `🎉 Pro Lifetime (${earlyBirdRemaining} left) — $49 ตลอดชีพ`;
    upgradeBtn.classList.add('early-bird');
    upgradeBtn.dataset.link = STRIPE_LINKS.lifetime;
  } else {
    upgradeBtn.textContent = '💎 Upgrade to Pro — $99/year';
    upgradeBtn.classList.remove('early-bird');
    upgradeBtn.dataset.link = STRIPE_LINKS.yearly;
  }
}

function renderUnfollowers(unfollowers) {
  if (!unfollowers.length) {
    unfollowListDiv.innerHTML = '✅ No unfollowers found yet. Try scanning again later.';
    return;
  }

  if (isPro) {
    unfollowListDiv.innerHTML = `
      <strong>⚠️ ${unfollowers.length} people unfollowed you:</strong><br><br>
      ${unfollowers.map(u => `<a href="https://www.instagram.com/${u}/" target="_blank">@${u}</a>`).join(' &nbsp;·&nbsp; ')}
    `;
  } else {
    const visible = unfollowers.slice(0, FREE_VISIBLE_COUNT);
    const hidden = unfollowers.slice(FREE_VISIBLE_COUNT);

    let html = `<strong>⚠️ ${unfollowers.length} people unfollowed you:</strong><br><br>`;
    html += visible.map(u => `<a href="https://www.instagram.com/${u}/" target="_blank">@${u}</a>`).join(' &nbsp;·&nbsp; ');

    if (hidden.length > 0) {
      const fakeNames = hidden.map((_, i) => `@user${String(i + 1).padStart(4, '0')}`);
      html += ` &nbsp;·&nbsp; <span class="blurred">${fakeNames.join(' · ')}</span>`;
      html += `
        <div class="paywall-box">
          <p>🔒 ${hidden.length} more unfollowers hidden — upgrade to see them all</p>
          <a href="${upgradeBtn.dataset.link || STRIPE_LINKS.yearly}" target="_blank" class="btn-inline-upgrade">
            Pro Lifetime $49 · ดูทั้งหมด
          </a>
        </div>
      `;
    }

    unfollowListDiv.innerHTML = html;
  }
}

// ==================== INIT ====================
async function init() {
  showStatus('Loading...');
  currentEmail = await getUserEmail();

  const [proStatus, ebRemaining] = await Promise.all([
    checkProStatus(currentEmail),
    fetchEarlyBirdRemaining(),
  ]);

  isPro = proStatus.isPro ?? false;
  earlyBirdRemaining = ebRemaining;

  if (isPro) {
    proBadge.style.display = 'block';
    upgradeBtn.style.display = 'none';
    earlyBirdNotice.style.display = 'none';
    const option = maxLimitSelect.querySelector('option[value="0"]');
    if (option) option.textContent = 'Unlimited (Pro ✓)';
  } else {
    updateUpgradeButton();
    if (earlyBirdRemaining > 0) {
      earlyBirdNotice.style.display = 'block';
      earlyBirdNotice.textContent = `🔥 Early Bird: Only ${earlyBirdRemaining} Pro spots left at $49/year!`;
    }
  }

  showStatus('✨ Open your Followers list on Instagram, then click Scan');
}

// ==================== SCAN ====================
scanBtn.addEventListener('click', async () => {
  if (scanning) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showStatus('❌ No active tab found');
    return;
  }

  if (!tab.url?.includes('instagram.com')) {
    showStatus('❌ Please open instagram.com first');
    return;
  }

  const maxUsers = isPro ? 0 : parseInt(maxLimitSelect.value, 10);

  scanning = true;
  scanBtn.style.display = 'none';
  stopBtn.style.display = 'block';
  showStatus('🔄 Scanning followers... please wait');

  try {
    const response = await sendToContent(tab.id, { action: 'get_list', maxUsers });

    if (response?.error) {
      showStatus(`❌ ${response.error}`);
      return;
    }

    const currentList = response?.data ?? [];
    const previousList = await getStoredList();

    countSpan.textContent = currentList.length;
    resultBox.style.display = 'block';
    userFollowerCount = currentList.length;

    if (previousList.length === 0) {
      await saveList(currentList);
      showStatus('✅ First scan complete! Scan again later to see unfollowers.');
      unfollowListDiv.innerHTML = '📌 First scan saved. Come back after some time to detect unfollowers.';
      return;
    }

    const previousSet = new Set(previousList);
    const unfollowers = previousList.filter(u => !currentList.includes(u));
    lastUnfollowers = unfollowers;

    await saveList(currentList);

    if (unfollowers.length === 0) {
      showStatus('✅ Scan complete — no unfollowers detected!');
    } else {
      showStatus(`⚠️ Found ${unfollowers.length} unfollower(s)`);
    }

    renderUnfollowers(unfollowers);

  } catch (err) {
    showStatus(`❌ Error: ${err.message}`);
  } finally {
    scanning = false;
    scanBtn.style.display = 'block';
    stopBtn.style.display = 'none';
  }
});

stopBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await sendToContent(tab.id, { action: 'stop_scroll' });
    } catch {}
  }
  scanning = false;
  scanBtn.style.display = 'block';
  stopBtn.style.display = 'none';
  showStatus('⏹ Scan stopped');
});

upgradeBtn.addEventListener('click', () => {
  const link = upgradeBtn.dataset.link || STRIPE_LINKS.yearly;
  chrome.tabs.create({ url: link });
});

init();
