# 📋 Panduan Setup & Instalasi

## 🔧 Prasyarat

Sebelum memulai, pastikan Anda sudah menginstall:
- Node.js v18+ 
- npm atau yarn
- Git

---

## 📦 Instalasi Dependencies

### 1. Install dari Package.json
```bash
npm install
# atau
yarn install
```

### 2. Verify Instalasi
```bash
npm list pdfkit
npm list nodemailer
```

Pastikan output menunjukkan versi:
- `pdfkit@^0.13.0`
- `nodemailer@^9.0.5`

---

## 🔐 Setup Environment Variables

### 1. Create File `.env.local`
```bash
cp .env.example .env.local
```

### 2. Edit `.env.local` dan tambahkan:

#### **Supabase Configuration**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Cara mendapat:**
1. Login ke https://supabase.com
2. Buka project Anda
3. Settings → API → Copy URL dan Keys

#### **Midtrans Configuration**
```env
MIDTRANS_SERVER_KEY=your-server-key-here
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your-client-key-here
```

**Cara mendapat:**
1. Login ke https://account.midtrans.com
2. Go to Sandbox Settings
3. API Keys tab → Copy Server Key & Client Key

#### **SMTP Email Configuration**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@kographstore.com
SMTP_SECURE=false
```

**Untuk Gmail:**
1. Enable 2-Factor Authentication
2. Generate App Password di https://myaccount.google.com/apppasswords
3. Copy password dan paste ke SMTP_PASSWORD

**Untuk Email Provider Lain:**
- Gmail: `smtp.gmail.com:587`
- Outlook: `smtp-mail.outlook.com:587`
- Zoho: `smtp.zoho.com:587`
- SendGrid: `smtp.sendgrid.net:587`

#### **App URL**
```env
NEXTAUTH_URL=http://localhost:3000
# Production:
# NEXTAUTH_URL=https://yourdomain.com
```

---

## 📱 Environment Variables Template

Buat file `.env.example`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Midtrans
MIDTRANS_SERVER_KEY=
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_SECURE=

# App
NEXTAUTH_URL=http://localhost:3000
```

---

## 🗄️ Database Setup

### 1. Run Migration
```bash
# Login ke Supabase
supabase link

# Run migrations
supabase migration up
```

Atau manual:
1. Buka Supabase dashboard
2. SQL Editor
3. Copy isi file `supabase/migrations/20250813_*.sql`
4. Jalankan query

### 2. Verify Tables
Di Supabase SQL Editor, jalankan:
```sql
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Pastikan ada tabel:
- `profiles`
- `shops`
- `products`
- `orders`
- `order_items`
- `follows`
- `reviews`
- `notifications`

---

## 🚀 Run Development Server

```bash
npm run dev
# atau
yarn dev
```

Buka http://localhost:3000 di browser

### Troubleshooting:

**Error: Cannot find module 'pdfkit'**
```bash
npm install pdfkit --save
npm install @types/pdfkit --save-dev
```

**Error: SMTP connection failed**
- Pastikan SMTP credentials benar
- Cek firewall/network settings
- Untuk Gmail, pastikan "Less secure apps" enabled atau gunakan App Password

**Error: Supabase connection failed**
- Verifikasi URL dan keys benar
- Cek network connection
- Pastikan RLS policies configured

---

## 🧪 Testing Fitur

### 1. Test Digital Product Email
```bash
# Manual test via API
curl -X POST http://localhost:3000/api/products/send-digital \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test-order-id"}'
```

### 2. Test Midtrans Webhook
```bash
# Simulate Midtrans notification
curl -X POST http://localhost:3000/api/payments/midtrans-notification \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "test-order",
    "status_code": "200",
    "gross_amount": "100000",
    "signature_key": "...",
    "transaction_status": "settlement"
  }'
```

### 3. Test Real-time Reviews
1. Buka product detail di 2 tab
2. Tulis review di tab pertama
3. Tab kedua harus auto-refresh reviews

### 4. Test Follow Seller
1. Login dengan 2 akun berbeda
2. Akun 1 follow seller dengan akun 2
3. Cek follower count increase
4. Unfollow dan cek decrease

---

## 🔄 Build & Deploy

### Local Build
```bash
npm run build
npm run start
```

### Deploy ke Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Variables di Production
1. Go to Vercel Dashboard
2. Project → Settings → Environment Variables
3. Tambahkan semua variables dari `.env.local`

---

## 📊 Database Backup

### Backup Supabase Data
```bash
# Via CLI
supabase db pull

# Via Dashboard
Supabase → Backups → Create new backup
```

---

## 🆘 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| 500 Error di send-digital | SMTP tidak configured | Set SMTP vars di `.env.local` |
| Email tidak terkirim | Credentials salah | Verifikasi SMTP_USER & PASSWORD |
| PDF tidak generate | pdfkit belum installed | Run `npm install pdfkit` |
| Midtrans webhook fail | Signature mismatch | Pastikan SERVER_KEY benar |
| Follow tidak work | RLS policy issue | Check Supabase RLS policies |
| Reviews tidak real-time | Subscription fail | Check Supabase real-time enabled |

---

## 📚 Useful Links

- **Supabase Docs:** https://supabase.com/docs
- **Midtrans Docs:** https://midtrans.com/en/developers
- **PDFKit Guide:** http://pdfkit.org/
- **Nodemailer:** https://nodemailer.com/
- **Next.js Docs:** https://nextjs.org/docs

---

## ✅ Pre-Launch Checklist

- [ ] Semua env variables ter-set
- [ ] Database migration sudah run
- [ ] Dependencies ter-install (`npm install`)
- [ ] Dev server bisa jalan (`npm run dev`)
- [ ] SMTP email working
- [ ] Midtrans webhook working
- [ ] Real-time features working
- [ ] Build sukses (`npm run build`)

---

**Created:** 2025-08-13
**Last Updated:** 2025-08-13
