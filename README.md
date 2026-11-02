# UNFOLLOW TRACKER – Chrome Extension

## Setup Before Publishing

### 1. Update API URL in `popup.js`
After deploying your Replit app, replace:
```js
const API_BASE_URL = 'https://your-app.replit.app/api';
```
With your actual deployed URL.

### 2. Add Stripe Payment Links in `popup.js`
```js
const STRIPE_LINKS = {
  monthly: 'https://buy.stripe.com/YOUR_MONTHLY_LINK',
  yearly: 'https://buy.stripe.com/YOUR_YEARLY_LINK',
  earlyBird: 'https://buy.stripe.com/YOUR_EARLYBIRD_LINK'
};
```

### 3. Add Icons
Place your icon files in the `icons/` folder:
- `icons/icon16.png` (16×16)
- `icons/icon48.png` (48×48)
- `icons/icon128.png` (128×128)

### 4. Load in Chrome (Developer Mode)
1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `extension/` folder

### 5. Set Up Stripe Webhook
In your Stripe Dashboard, create a webhook pointing to:
```
https://your-app.replit.app/api/stripe/webhook
```
Listen for events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.deleted`

Set the `STRIPE_WEBHOOK_SECRET` and `STRIPE_SECRET_KEY` environment secrets in Replit.

### 6. Add Metadata to Stripe Payment Links
In each Stripe Payment Link, add metadata:
- `plan_type` = `yearly`, `monthly`, or `early_bird`

This lets the webhook know which plan was purchased.
