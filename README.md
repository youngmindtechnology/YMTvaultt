# 🔒 YoungVault — Locked Savings Vault
### By Young Mind Technology

A full-stack savings app that locks your money until a set date — preventing impulsive spending.

---

## 🚀 Quick Start (Run Locally)

### Prerequisites
- Node.js v16+ installed → [nodejs.org](https://nodejs.org)
- A Paystack account (free) → [paystack.com](https://paystack.com)

---

### Step 1: Install Dependencies

```bash
cd youngvault/backend
npm install
```

---

### Step 2: Configure Paystack (Optional for live payments)

Open `backend/server.js` and replace:
```javascript
const PAYSTACK_SECRET = 'sk_test_your_paystack_secret_key_here';
```
With your actual Paystack **Test Secret Key** from:
👉 [dashboard.paystack.com/settings/developer](https://dashboard.paystack.com/settings/developer)

> **Note:** The app works in **Demo Mode** without Paystack — great for testing!

---

### Step 3: Start the Server

```bash
cd backend
node server.js
```

You'll see:
```
🚀 YoungVault Server running at http://localhost:3000
```

---

### Step 4: Open in Browser

Visit: **http://localhost:3000**

---

## 📁 Project Structure

```
youngvault/
├── backend/
│   ├── server.js          # Express API server
│   ├── database.json      # JSON database (auto-created)
│   └── package.json       # Node dependencies
└── frontend/
    ├── index.html         # All 6 pages (SPA)
    ├── css/
    │   └── style.css      # Full styling
    └── js/
        └── app.js         # Frontend logic
```

---

## 🌐 API Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Create new account | No |
| POST | `/login` | Login user | No |
| GET | `/balance` | Get wallet balance | Yes |
| GET | `/transactions` | Get all transactions | Yes |
| GET | `/vaults` | Get all vaults | Yes |
| POST | `/deposit` | Demo deposit | Yes |
| POST | `/initialize-payment` | Start Paystack payment | Yes |
| POST | `/verify-payment` | Verify Paystack payment | Yes |
| POST | `/create-vault` | Lock savings in vault | Yes |
| POST | `/withdraw` | Withdraw from unlocked vault | Yes |

---

## 💳 Payment Integration

### Demo Mode (Default)
- Select "Demo Mode" on the deposit page
- Money is added instantly — great for testing

### Paystack Mode (Real Payments)
1. Add your Paystack test secret key in `server.js`
2. Select "Paystack" on deposit page
3. Complete payment in Paystack popup
4. Click "Verify & Credit Wallet"

---

## 🗂️ Database Structure (JSON)

```json
{
  "users": [
    {
      "id": "1234567890",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phone": "+234800000000",
      "password": "[bcrypt hashed]",
      "balance": 5000,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "transactions": [
    {
      "id": "tx_001",
      "userId": "1234567890",
      "type": "deposit | vault_lock | vault_unlock",
      "amount": 5000,
      "reference": "REF_001",
      "status": "success",
      "description": "Wallet deposit",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "vaults": [
    {
      "id": "vault_001",
      "userId": "1234567890",
      "label": "Phone Fund",
      "amount": 50000,
      "duration": 3,
      "unlockDate": "2024-04-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "status": "locked | withdrawn"
    }
  ]
}
```

---

## 🔐 Security Features

- Passwords hashed with **bcryptjs** (salt rounds: 10)
- JWT authentication (7-day expiry)
- All protected routes require Bearer token
- Vault withdrawal blocked before unlock date
- Input validation on all endpoints

---

## 🎨 Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Yellow | `#FFD000` | Primary CTA, highlights |
| Blue (Dark) | `#0A2472` | Primary brand, text |
| Blue (Mid) | `#0E4C96` | Gradients |
| White | `#FFFFFF` | Backgrounds, text |

---

## 🚢 Deploy to Production

### Using Railway (Recommended - Free)
1. Push to GitHub
2. Connect to [railway.app](https://railway.app)
3. Set environment variables (PAYSTACK_SECRET)
4. Deploy!

### Using Render
1. Connect GitHub repo
2. Set build command: `cd backend && npm install`
3. Set start command: `node backend/server.js`

---

## 📞 Support

Built by **Young Mind Technology**

For issues or customizations, contact your development team.

---

*"Stay disciplined. Future you will thank you."* 🔒
