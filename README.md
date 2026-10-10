# Alpha Elevators Customer Project CRM & WhatsApp Group Automation

A production-grade, enterprise B2B CRM built for **Alpha Elevators** to manage residential elevator projects from initial 30% advance payment through factory fabrication, delivery, and installation, while automatically keeping customers informed through their dedicated WhatsApp communication groups using the **Official Meta WhatsApp Business Platform / Cloud API**.

---

## 1. System Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │           Next.js 14 Frontend UI             │
                  │  (Dashboard, Projects, Timeline, WhatsApp)   │
                  └──────────────────────┬───────────────────────┘
                                         │ REST API / JWT
                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Node.js / Express Backend                       │
│                                                                        │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐ │
│  │   WhatsApp Service   │ │ Node-Cron Scheduler  │ │ Webhook Engine │ │
│  │ (Meta Cloud API v20) │ │ (Idempotent 10/20d)  │ │ (Async Ingest) │ │
│  └──────────┬───────────┘ └──────────┬───────────┘ └───────┬────────┘ │
└─────────────┼────────────────────────┼─────────────────────┼──────────┘
              │                        │                     │
              ▼                        ▼                     ▼
┌───────────────────────────┐                    ┌──────────────────────┐
│  Official Meta Graph API  │                    │ MongoDB Atlas DB     │
│  - Group Messaging        │                    │ - Customer, Project  │
│  - Approved Templates     │                    │ - WhatsAppChannel    │
│  - Webhook Delivery Status│                    │ - WhatsAppMessage    │
└───────────────────────────┘                    │ - Activity & Events  │
                                                 └──────────────────────┘
```

### Key Architectural Tenets
1. **No Third-Party Automation Proxies**: Does NOT use n8n, Zapier, or unofficial browser scrapers. Built directly in Node.js.
2. **Dedicated WhatsApp Service Layer** (`backend/src/services/whatsapp/`): Completely decouples Meta API logic from core CRM entities.
3. **Idempotency & Re-entrancy Protection**: Every scheduled message computes an idempotency key (`projectId_scheduledUpdateDate_templateName`). If the server restarts or a job overlaps, duplicates are impossible.
4. **Group Isolation**: Every project is mapped to a unique `whatsappGroupId`. Groups can never be mixed up across customers.

---

## 2. Directory Structure

```
Alpha CRM/
├── backend/
│   ├── src/
│   │   ├── config/             # DB connection with MongoDB Memory Server fallback & env config
│   │   ├── middleware/         # JWT authentication & RBAC roles
│   │   ├── models/             # Mongoose schemas with indexes, timestamps & validations
│   │   │   ├── Customer.ts
│   │   │   ├── Payment.ts
│   │   │   ├── Project.ts
│   │   │   ├── ProjectActivity.ts
│   │   │   ├── SystemSettings.ts
│   │   │   ├── User.ts
│   │   │   ├── WebhookEvent.ts
│   │   │   ├── WhatsAppChannel.ts
│   │   │   ├── WhatsAppMessage.ts
│   │   │   └── WhatsAppTemplate.ts
│   │   ├── routes/             # REST API routers (customers, projects, payments, etc.)
│   │   ├── services/
│   │   │   ├── activity/       # Audit & project activity logger
│   │   │   ├── scheduler/      # 10/15/20-day cron engine & idempotency check
│   │   │   └── whatsapp/       # Meta WhatsApp Business Cloud API service
│   │   ├── scripts/
│   │   │   ├── acceptanceTest.ts # End-to-end Section 43 Acceptance Test script
│   │   │   └── seed.ts         # Realistic 10 pilot projects & 13 templates seeder
│   │   └── server.ts           # Express server entry point
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── customers/      # Customer directory and detail views
│   │   │   ├── login/          # Authentication screen with demo logins
│   │   │   ├── pilot/          # 10-Customer Pilot Mode tracker
│   │   │   ├── projects/       # Projects directory & Master Project Detail page
│   │   │   ├── reports/        # Financial & WhatsApp delivery reports
│   │   │   ├── settings/       # System & Meta credentials settings
│   │   │   ├── templates/      # 13 approved WhatsApp templates
│   │   │   ├── whatsapp/       # WhatsApp communication hub & stream
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx        # Dashboard with Today's Actions
│   │   ├── components/         # Reusable UI components
│   │   │   ├── Navbar.tsx
│   │   │   ├── PostponeModal.tsx
│   │   │   ├── RecordPaymentModal.tsx
│   │   │   ├── SendUpdateModal.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Timeline.tsx    # Interactive 12-milestone project timeline
│   │   └── lib/api.ts          # Typed REST API client
│   ├── package.json
│   └── tailwind.config.ts
│
├── API_DOCUMENTATION.md        # Complete REST API specification
├── .env.example                # Sample environment configuration
└── package.json                # Root orchestrator
```

---

## 3. Environment Variables Setup

Copy `.env.example` into `backend/.env` and `frontend/.env.local`:

```bash
cp .env.example backend/.env
```

Key variables:
- `MONGODB_URI`: Connection string to MongoDB Atlas or local MongoDB. (If left unset in development, the backend automatically boots an embedded in-memory MongoDB database for zero-friction local execution!)
- `JWT_SECRET`: Secret key for signing employee JWT tokens.
- `META_ACCESS_TOKEN`: System User Permanent Access Token with `whatsapp_business_messaging` permissions.
- `META_PHONE_NUMBER_ID`: WhatsApp Business Phone Number ID from Meta App Dashboard.
- `META_WABA_ID`: WhatsApp Business Account ID.
- `META_VERIFY_TOKEN`: Random secure string used to verify your webhook with Meta.
- `META_API_VERSION`: Current Meta Graph API version (default: `v20.0`).
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: `http://localhost:5000`).

---

## 4. Local Development

### 1. Install Dependencies
From the repository root:
```bash
npm run install:all
```

### 2. Seed Initial Pilot Database
Seeds 10 pilot elevator projects (including Kumar Residence, Raj Residence), 13 approved WhatsApp templates, and Admin/CRM credentials:
```bash
npm run seed
```

### 3. Run Acceptance Test
Verifies the complete Section 43 Acceptance Test scenario:
```bash
npm run test:acceptance
```

### 4. Start Development Servers
Run both backend and frontend concurrently:
```bash
npm run dev
```
- Frontend UI: `http://localhost:3000`
- Backend REST API: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

### 5. Demo Login Credentials
- **Admin**: `admin@alphaelevators.com` / `admin123` (Full system access)
- **CRM Agent**: `crm@alphaelevators.com` / `crm123` (Customers, Projects, Payments, WhatsApp)

---

## 5. Meta WhatsApp Business Cloud API Configuration

### Step 1: Create Meta Developer App
1. Go to [developers.facebook.com](https://developers.facebook.com).
2. Create an App of type **Business**.
3. Under Add Products, select **WhatsApp**.
4. In the WhatsApp Getting Started page, copy your **Phone Number ID** and **WhatsApp Business Account ID (WABA ID)** into `backend/.env`.

### Step 2: Configure Webhook
1. Go to **WhatsApp > Configuration > Webhook**.
2. Set Callback URL: `https://<YOUR_VPS_DOMAIN>/api/webhooks/whatsapp`
3. Set Verify Token: The value of `META_VERIFY_TOKEN` in your `.env`.
4. Subscribe to Webhook fields:
   - `messages` (incoming customer replies in groups)
   - `message_template_status_update`
   - `message_status` (`sent`, `delivered`, `read`, `failed`)

### Step 3: Meta Templates Approval
The system ships with 13 approved templates mapped to elevator engineering milestones:
- `PAYMENT_CONFIRMATION`
- `PROJECT_STARTED`
- `SITE_MEASUREMENT`
- `DESIGN_UPDATE`
- `CUSTOMER_APPROVAL`
- `ENGINEERING_UPDATE`
- `MANUFACTURING_UPDATE`
- `PROGRESS_UPDATE`
- `QUALITY_CHECK`
- `DISPATCH_UPDATE`
- `DELIVERY_UPDATE`
- `INSTALLATION_UPDATE`
- `PROJECT_COMPLETED`

---

## 6. WhatsApp Group Automation & Scheduling Engine

- **Node.js Scheduler**: Built using `node-cron`. Evaluates projects every morning at 09:00 AM IST and maintains a 15-minute background heartbeat.
- **Project Selection Filter**:
  `automationEnabled = true` AND `nextUpdateAt <= NOW` AND `projectStatus != COMPLETED|CANCELLED|ON_HOLD` AND `whatsappGroupId != null` AND `customer.whatsappOptIn = true`
- **Cadence Options**: Per-project frequency: 10 days, 15 days, 20 days (default), or custom.
- **Manual Overrides**:
  - `[Send Update Now]`: Dispatches stage update immediately and advances next update date.
  - `[Postpone]`: Postpones update by 3, 5, 7, or 14 days with audit reason note.
  - `[Pause / Resume]`: Temporarily halts automated dispatches for a project.
  - `[Change Frequency]`: Dynamically adjusts cadence per customer.

---

## 7. Production Deployment (VPS & Vercel)

### Frontend on Vercel
1. Link the repository to Vercel.
2. Set Root Directory to `frontend`.
3. Set Environment Variable: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`.
4. Deploy!

### Backend on VPS (Ubuntu / Linux)
1. Install Node.js v20+ and PM2:
   ```bash
   npm install -g pm2
   ```
2. Set up environment variables in `/var/www/alpha-crm/backend/.env`.
3. Build and launch with PM2:
   ```bash
   cd backend
   npm install
   npm run build
   pm2 start dist/server.js --name "alpha-crm-backend"
   pm2 save
   ```
4. Set up Nginx reverse proxy with HTTPS (Let's Encrypt SSL is required for Meta webhooks):
   ```nginx
   server {
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## 8. Security & Compliance

- **Role-Based Access Control (RBAC)**: Validates authorization on every endpoint (`ADMIN`, `CRM`, `MANAGER`, `VIEWER`).
- **Encrypted Password Storage**: Uses `bcryptjs` salted hashes.
- **Security Headers**: Express configured with `helmet`, CORS restriction, and strict JSON payloads.
- **Token Protection**: Access tokens are kept strictly in backend environment variables and never exposed to the client.
- **Opt-In Protection**: Customers can withdraw consent at any time; the scheduler strictly suppresses messages when `whatsappOptIn = false`.

---

## 9. Troubleshooting & Diagnostics

- **Meta Cloud API Test Mode**: Enabled by default in development (`whatsappTestMode: true`). It simulates authentic Meta message IDs (`wamid.HBgM...`) so you can test all workflows and webhooks without incurring Meta API charges.
- **Trigger Scheduler Manually**: In the UI, click **Run Scheduler** in the top navigation bar or invoke `POST /api/settings/trigger-scheduler` to immediately execute an update check cycle.
- **Health Check**: Visit `GET /api/health` to confirm server status and active Graph API version.
