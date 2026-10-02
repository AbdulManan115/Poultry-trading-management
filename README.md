# Poultry Farm Management Dashboard & Customer Portal

Full-stack project built with:
- Frontend: Next.js (React) + Tailwind CSS
- Backend: Node.js + Express
- Auth: JWT

## Demo Accounts
- Admin: `admin@farm.com` / `admin123`
- Employee: `employee@farm.com` / `employee123`
- Customer: `customer@farm.com` / `customer123`

## Run Backend
```bash
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:4000`.

## Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`.

If backend URL is different, set:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Implemented SRS Modules (MVP)
- Role-based login (admin, employee, customer)
- Dashboard summary (sales, pending, received, profit)
- Customer management (admin)
- Transactions with payment split (cash/bank/easypaisa)
- Inventory view and stock deduction on sales
- Customer portal with personal transactions only
- Excel upload endpoint for transaction import (`/api/transactions/upload`)
