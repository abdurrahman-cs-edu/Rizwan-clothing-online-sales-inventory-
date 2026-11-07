# Rizwan Clothing – AI Business Intelligence System

A full-stack web application for **Rizwan Clothing**, a real clothing store. It manages online orders, customer credit (Khata) and the design catalogue, and turns the sales data into interactive dashboards and reports. An AI business assistant is in progress.

This is also my **Final Year Project**.

* **Live app:** [final-project-one-gray.vercel.app](https://final-project-one-gray.vercel.app)
* **Status:** in active development (started June 2026)

---

## Screenshots

<img width="1360" height="619" alt="dashboard" src="https://github.com/user-attachments/assets/69d3cefb-abe4-44ee-b4f1-c4b944e679b6" />
<img width="1365" height="623" alt="reports" src="https://github.com/user-attachments/assets/91f61173-90ba-400a-8a5d-3bcd4fc62e22" />
<img width="1363" height="623" alt="dashboard-charts" src="https://github.com/user-attachments/assets/d5206b55-15ac-4c78-b218-dc3a872f9afd" />
<img width="1354" height="621" alt="designs" src="https://github.com/user-attachments/assets/1d2bf0af-7456-4b71-a41d-c03f7380c568" />



## Features

### Sales and orders
* Online orders with several designs per order and sizes **S, M, L, XL, XXL**
* Payment types: **Advance** and **Cash on Delivery (COD)**
* Delivery by **PostEx** (order code + city) or **local rider** (D&D / Service Delivery + city)
* COD paid / unpaid tracking with payment method (Cash, Easypaisa, JazzCash, Bank Transfer)
* Pending payments, PostEx orders, D&D parcels and full sales history views
* JSON export and import (backup / restore)

### Khata (customer credit ledger)
* One profile per shop owner with all purchases, sizes, notes and paid / unpaid status
* Duplicate and similar-name check before creating a new customer

### Design catalogue (admin)
* Designs with fabric, selling price and cost per suit
* Order and Khata forms can only use designs from the catalogue: type to search, **"No items found"** for unknown names, price fills in automatically (still editable for discounts)
* Similar design names are flagged; designs are hidden, never deleted, so old sales stay valid
* Old misspelled design names in past orders are linked to the correct design through an alias table, without rewriting historical records

### Dashboard
* Today's sales, this month's sales and orders, pending COD (cards open the matching orders)
* Sales overview: Today / This Week / This Month / This Year, with change vs the previous period
* Top designs, recent orders, quick insights (best day, busiest time, average order)
* Delivery by city (local rider and PostEx), sizes sold and fabric mix

### Charts & Reports
Date filter (all time, this month, last 30 days or custom) plus seven reports:
* **Sales** – trend (daily / weekly / monthly) and best days of the week
* **Profit** – gross profit, margin, most profitable designs, loss and low-margin warnings
* **Designs** – top designs by suits and by sales amount, slow-moving designs
* **Sizes** – suits, share, sales and best-selling design per size
* **Fabric** – suits, designs, share and sales per fabric
* **Delivery & Payment** – Advance vs COD, COD paid vs unpaid, delivery channel, parcels per city
* **Customers** – customers, repeat customers and top spenders

### In progress
* **AI Business Assistant** – answers questions in English, Urdu or Roman Urdu using real numbers calculated from the database (sales trends, slow movers, profit, best fabrics), with short-term forecasts and buying suggestions
* Login with **admin** and **staff** roles

---

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS (CDN), Recharts |
| Backend | Supabase: PostgreSQL, Row Level Security, Edge Functions (Deno) |
| Build | `vite-plugin-singlefile` (the whole app is built into one `index.html`) |
| Deployment | Vercel through GitHub Actions on every push to `main` |

### How data flows
* The app **reads** data from Supabase tables and views.
* All **writes** (add / edit / delete orders, Khata entries and designs) go through one protected Supabase Edge Function (`protected-mutation`), which also validates the data on the server (for example: only catalogue designs, no duplicate order numbers, city required for PostEx).

### Main database objects
| Name | Type | Purpose |
|---|---|---|
| `sales` | table | Online orders (items, sizes, totals, payment and delivery details) |
| `khata_entries` | table | Khata purchases per shop owner |
| `designs` | table | Design catalogue: name, fabric, price, cost, active / hidden |
| `design_aliases` | table | Old spelling → real design (keeps historical orders unchanged) |
| `postex_city_codes` | table | PostEx order-code prefix → city for older orders |
| `design_lines` | view | One row per design line from sales and Khata, linked to the real design (used by reports) |

---

## Project structure

```
src/
  App.jsx             Main app: layout, sidebar, orders, Khata, tabs
  DashboardHome.jsx   Dashboard (cards, sales overview, donuts)
  AnalyticsPanel.jsx  Charts & Reports (7 reports)
  DesignsPanel.jsx    Admin design catalogue
  DesignPicker.jsx    Design search box used in the Order and Khata forms
  supabaseClient.js   Supabase client
```

---

## Run locally

Requirements: **Node.js 20.19+ or 22.12+** and npm.

```bash
git clone https://github.com/abdurrahman-cs-edu/Rizwan-clothing-online-sales-inventory-.git
cd Rizwan-clothing-online-sales-inventory-
npm install
npm run dev
```

Then open the address shown in the terminal (usually `http://localhost:5173`).

> Note: the local app connects to the same Supabase project as the live site, so anything saved locally is saved to the real data.

Build for production:

```bash
npm run build
```

---

## Author

**Abdur Rahman** – Final Year Project, built for Rizwan Clothing.
