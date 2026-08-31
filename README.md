# Rizwan Clothing - Inventory Management System

A custom full-stack web application built to digitize and streamline daily retail operations, inventory tracking, and sales management for Rizwan Clothing[cite: 8].

* **Live Demo:** [https://final-project-one-gray.vercel.app](https://final-project-one-gray.vercel.app)[cite: 8]
* **Repository:** [https://github.com/abdurrahman-cs-edu/final-project](https://github.com/abdurrahman-cs-edu/final-project)[cite: 8]

## Overview
This project transitions traditional retail operations into a fully digital workflow. It tracks real-time inventory availability, monitors specific stock sizes and product categories, and handles multi-channel payment accounting[cite: 8].

## Tech Stack
* **Frontend:** React, Vite, Tailwind CSS[cite: 8]
* **Backend & Database:** Supabase (PostgreSQL with Row Level Security)[cite: 8]
* **Deployment & Hosting:** Vercel[cite: 8]
* **Version Control:** Git, GitHub[cite: 8]

## Key Features
* **Digital Inventory Tracking:** Real-time stock visibility across various product categories and specific clothing sizes[cite: 8].
* **Automated Sales Processing:** Streamlines daily sales entries with automated calculations and record-keeping[cite: 8].
* **Multiple Payment Channels:** Fully integrated tracking for diverse logistics and payment methods including Cash on Delivery, PostEx, local riders, and advance payments[cite: 8].

## Getting Started
To run this project locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/abdurrahman-cs-edu/final-project.git
   cd final-project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory and add your Supabase project credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
