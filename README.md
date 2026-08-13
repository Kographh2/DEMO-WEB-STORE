# Kograph Store

Platform jual beli online dengan sistem toko dan seller yang minimalis dan modern.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **Payment**: Midtrans Snap
- **State Management**: Zustand + React Query
- **Animations**: Framer Motion

## Features

- Multi-role system (Owner, Admin, Seller, Customer)
- Product listing with ratings and reviews
- Shopping cart with discount support
- Checkout with COD and Midtrans Snap
- Seller dashboard with analytics
- Owner dashboard with user management and withdrawal processing
- Follow/follower system
- Real-time notifications
- PWA support (installable on mobile)
- Mobile-first design with desktop fallback
- Bottom navbar with liquid glass effect (mobile)
- Top navbar (desktop)

## Setup

1. Clone repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.local` and fill in your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   MIDTRANS_SERVER_KEY=your_midtrans_server_key
   MIDTRANS_CLIENT_KEY=your_midtrans_client_key
   MIDTRANS_IS_PRODUCTION=false
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
4. Run the Supabase schema from `supabase/schema.sql`
5. Start development server:
   ```bash
   npm run dev
   ```

### Midtrans webhook

Set the Payment Notification URL in the Midtrans Dashboard to:

```text
https://your-domain.com/api/payments/midtrans-notification
```

The endpoint verifies Midtrans' SHA-512 signature before changing an order to paid. Never expose `MIDTRANS_SERVER_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in client-side variables.

> `supabase/schema.sql` is an initial clean-slate schema: it drops and recreates the listed tables. Do not run it against a production database that already contains live data; create a reviewed migration first.

## Database Schema

The complete database schema is in `supabase/schema.sql`. It includes:
- Profiles (with roles)
- Shops
- Products
- Cart items
- Orders and order items
- Reviews (product and shop)
- Follows
- Withdrawals
- Notifications
- Discounts
- Platform settings

## Commission Structure

- **Seller**: 97%
- **Platform**: 3%
- **Tax**: 5% per transaction

## Roles

- **Owner**: Full access, can add admin/seller, manage withdrawals
- **Admin**: Administration tasks, seller management
- **Seller**: Can sell products, manage shop
- **Customer**: Can browse and buy products

## License

MIT
