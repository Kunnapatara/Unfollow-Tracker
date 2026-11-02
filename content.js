// content.js
let stopScrolling = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_list') {
    const maxUsers = request.maxUsers || 0;
    stopScrolling = false;
    getAllUsernames(maxUsers)
      .then(data => sendResponse({ data, count: data.length }))
      .catch(err => sendResponse({ data: [], error: err.message }));
    return true;
  }
  if (request.action === 'stop_scroll') {
    stopScrolling = true;
    sendResponse({ stopped: true });
  }
});

async function getAllUsernames(maxUsers = 0) {
  const modal = document.querySelector('div[role="dialog"]');
  if (!modal) throw new Error('Please open the Followers list first');

  const scrollableDiv =
    modal.querySelector('div[style*="overflow: hidden auto"]') || modal;

  let lastHeight = 0;
  const usernames = new Set();

  while (true) {
    const links = modal.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const parts = link.href.split('/').filter(Boolean);
      const username = parts[parts.length - 1];
      if (
        username &&
        !username.includes('instagram') &&
        !username.includes('explore') &&
        username.length > 0
      ) {
        usernames.add(username);
        if (maxUsers > 0 && usernames.size >= maxUsers) {
          stopScrolling = true;
          break;
        }
      }
    }

    if (stopScrolling) break;

    scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
    await new Promise(resolve => setTimeout(resolve, 800));

    const newHeight = scrollableDiv.scrollHeight;
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;

    await new Promise(resolve => {
      if (window.requestIdleCallback) {
        requestIdleCallback(resolve, { timeout: 500 });
      } else {
        setTimeout(resolve, 50);
      }
    });
  }

  return Array.from(usernames);
}
