# Alpha Elevators CRM & WhatsApp Automation — API Documentation

This document describes all REST API endpoints, request bodies, authentication headers, and response formats for the **Alpha Elevators Customer Project CRM**.

---

## Base URL & Authentication

- **Base URL**: `http://localhost:5000` (Local) or VPS domain e.g. `https://api.alphaelevators.com`
- **Authentication**: JWT Bearer Token in `Authorization: Bearer <TOKEN>` header for all protected routes.
- **Roles**:
  - `ADMIN`: Unrestricted system access
  - `CRM`: Customers, Projects, Payments, WhatsApp dispatches
  - `MANAGER`: Customers, Projects, Reports, Monitoring
  - `VIEWER`: Read-only access

---

## 1. Authentication Endpoints

### `POST /api/auth/login`
Authenticates an administrator or CRM employee.

**Request:**
```json
{
  "email": "admin@alphaelevators.com",
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "670183...",
    "name": "Ashiqur Rahman (Admin)",
    "email": "admin@alphaelevators.com",
    "role": "ADMIN"
  }
}
```

### `GET /api/auth/me`
Fetches current logged-in user profile. Requires Bearer Token.

---

## 2. Customer Management Endpoints

### `GET /api/customers`
Retrieves list of customers.
- **Query Params**:
  - `search` (string): filter by name, phone, or customerId
  - `optIn` (`true` | `false`): filter by WhatsApp opt-in status
  - `customerType` (string): e.g. `Residential`, `Commercial`

### `POST /api/customers`
Creates a new customer record and automatically issues a customer code (`CUST-XXX`).

**Request:**
```json
{
  "fullName": "Kumar",
  "phoneNumber": "+919820011101",
  "whatsappNumber": "+919820011101",
  "email": "kumar@example.com",
  "address": "Plot 42, Palm Meadows, Whitefield",
  "city": "Bengaluru",
  "state": "Karnataka",
  "pincode": "560066",
  "customerType": "Residential",
  "leadSource": "Direct Inquiry",
  "whatsappOptIn": true,
  "optInSource": "PROJECT_CONFIRMATION"
}
```

### `GET /api/customers/:id`
Retrieves customer details along with linked projects, payment history, and WhatsApp communication records.

### `PATCH /api/customers/:id/opt-in`
Toggles WhatsApp consent.
```json
{
  "whatsappOptIn": true,
  "optInSource": "CUSTOMER_CONFIRMATION"
}
```

---

## 3. Project Management Endpoints

### `GET /api/projects`
Retrieves list of elevator projects.
- **Query Params**:
  - `status`: filter by stage (`MANUFACTURING`, `INSTALLATION`, etc.)
  - `paymentStatus`: `ADVANCE_PAID`, `PARTIAL_PAID`, `FULLY_PAID`
  - `updateDue`: `today`
  - `search`: search query

### `POST /api/projects`
Creates a project, books initial 30% advance payment, and schedules next WhatsApp update.

**Request:**
```json
{
  "customerId": "670183...",
  "projectName": "Kumar Residence",
  "siteAddress": "Plot 42, Palm Meadows, Whitefield, Bengaluru",
  "liftModel": "Alpha EV",
  "liftType": "Home Lift",
  "orderValue": 850000,
  "advancePercentage": 30,
  "expectedDeliveryDate": "2027-02-01T00:00:00.000Z",
  "updateFrequencyDays": 20,
  "whatsappGroupId": "GROUP_TEST_001"
}
```

### `GET /api/projects/:id`
Returns full project overview:
- Project document & customer populated
- WhatsApp Channel & linked group
- Milestone Payments history
- Live WhatsApp message stream & customer replies
- Activity audit trail

### `PATCH /api/projects/:id/status`
Updates project execution milestone and logs change in Activity History.
```json
{
  "status": "MANUFACTURING",
  "notes": "Cabin framework fabrication started"
}
```

---

## 4. Payment Management Endpoints

### `POST /api/payments`
Records advance, milestone, or balance payment, automatically updating project total paid and remaining balance.

**Request:**
```json
{
  "projectId": "670183...",
  "amountPaid": 255000,
  "paymentMethod": "BANK_TRANSFER",
  "transactionReference": "TXN_RTGS_98214",
  "paymentType": "ADVANCE_30",
  "notes": "Initial 30% advance received"
}
```

---

## 5. WhatsApp Integration & Control Endpoints

### `POST /api/whatsapp/link`
Links a unique WhatsApp Group ID to a project. Enforces one-to-one mapping across projects.
```json
{
  "projectId": "670183...",
  "whatsappGroupId": "META_GROUP_KUMAR_01",
  "groupName": "Kumar Residence — Alpha Updates"
}
```

### `POST /api/whatsapp/send`
Manually triggers immediate stage update to the project's WhatsApp group.
```json
{
  "projectId": "670183...",
  "templateNameOverride": "MANUFACTURING_UPDATE",
  "customNote": "Shaft plumb alignment verified by site engineer."
}
```

### `POST /api/whatsapp/postpone`
Postpones next automated update by a specified number of days (e.g. 3, 5, 7, 14 days).
```json
{
  "projectId": "670183...",
  "postponeDays": 7,
  "reason": "Awaiting customer civil shaft curing"
}
```

### `POST /api/whatsapp/pause`
Pauses automated messaging for a project.
```json
{
  "projectId": "670183...",
  "reason": "Civil work delayed by customer"
}
```

### `POST /api/whatsapp/resume`
Resumes automated messaging and recalculates next update date.

### `PATCH /api/whatsapp/frequency`
Adjusts update frequency (10, 15, 20, or custom days).
```json
{
  "projectId": "670183...",
  "frequencyDays": 15
}
```

### `POST /api/whatsapp/reply`
Sends a direct text reply to the customer / group.
```json
{
  "projectId": "670183...",
  "messageText": "Hello Mr. Kumar, mechanical installation begins this Thursday."
}
```

---

## 6. Webhooks (Meta WhatsApp Business Platform)

### `GET /api/webhooks/whatsapp`
Meta Webhook Verification endpoint.
- Verifies `hub.verify_token` against `META_VERIFY_TOKEN`.
- Returns `hub.challenge` on success (HTTP 200).

### `POST /api/webhooks/whatsapp`
Receives asynchronous Meta Graph API events.
- **Idempotency Protection**: Ingests `status` changes and customer incoming messages once via `WebhookEvent.eventId`.
- **Delivery Receipts**: Updates status to `SENT`, `DELIVERED`, `READ`, or `FAILED`.
- **Group Messages**: Parses `group_id`, resolves Project & Customer, stores incoming message in project timeline.

---

## 7. Templates & Settings Endpoints

### `GET /api/templates`
Lists all 13 approved WhatsApp templates with their stage mappings and variable schema.

### `GET /api/settings`
Returns company profile, masked Meta Cloud API credentials, and diagnostics.

### `POST /api/settings/trigger-scheduler`
Immediately executes the 10/15/20-day update check cycle for testing and audits.
