# 🎯 Kograph Store - Payment System Update v2.0

## ✨ Fitur Baru & Peningkatan

### 1. **Real-Time Payment Status Pages**
- ✅ **Success Page** (`/payment-status/success`)
  - Menampilkan detail pesanan lengkap
  - Tombol unduh invoice
  - Link ke halaman status pesanan
  
- ⏳ **Pending Page** (`/payment-status/pending`)
  - Countdown timer pembayaran
  - Auto-refresh status payment
  - Instruksi untuk menyelesaikan pembayaran
  
- ❌ **Failed Page** (`/payment-status/failed`)
  - Alasan kegagalan pembayaran
  - Langkah-langkah troubleshooting
  - Opsi untuk mencoba pembayaran ulang

### 2. **Sistem Pembayaran Otomatis & Real-Time**
- Integrasi Midtrans Snap dengan real-time status updates
- COD (Cash on Delivery) dengan konfirmasi instant
- Auto-verification dari server Midtrans setiap 5 detik
- Webhook handler untuk notifikasi pembayaran

### 3. **Database Schema Updates**
Kolom baru ditambahkan untuk tracking:
- `snap_token` - Token untuk Midtrans Snap widget
- `snap_redirect_url` - URL redirect dari Midtrans
- `payment_status` - Status pembayaran dari Midtrans
- `payment_confirmed_at` - Waktu konfirmasi pembayaran
- `expires_at` - Waktu kadaluarsa pembayaran
- `payment_notifications` table untuk audit trail

### 4. **Payment Utilities & Hooks**
- `usePaymentStatus()` - Hook untuk polling status pembayaran
- `useOrderStatusSubscription()` - Real-time status updates via Supabase
- `payment-utils.ts` - Helper functions untuk payment logic
- Validasi email & nomor telepon Indonesia

## 🚀 Instalasi & Setup

### 1. Update Environment Variables
```env
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your_midtrans_client_key
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_SANDBOX=true  # Ubah ke false untuk production
NEXT_PUBLIC_APP_URL=http://localhost:3000  # URL aplikasi
NEXT_PUBLIC_COD_ENABLED=true
```

### 2. Update Database Schema
Jalankan migration:
```bash
npm run db:migrate
# atau
supabase migration up
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Update Midtrans Configuration di Supabase
- Set webhook URL di Midtrans Dashboard ke: `YOUR_APP_URL/api/payments/midtrans-notification`
- Pastikan server key dan client key sesuai

## 📝 API Endpoints

### POST `/api/payments/snap`
Membuat transaksi pembayaran Midtrans atau COD

**Request Body:**
```json
{
  "orderId": "order-123",
  "amount": 150000,
  "email": "customer@example.com",
  "phone": "08123456789",
  "customerName": "John Doe",
  "paymentMethod": "midtrans|cod",
  "itemDetails": [
    {
      "id": "prod-1",
      "price": 100000,
      "quantity": 1,
      "name": "Product Name"
    }
  ],
  "shippingAddress": {
    "full_name": "John Doe",
    "phone": "08123456789",
    "email": "customer@example.com",
    "address": "Jl. Example No. 123",
    "city": "Jakarta",
    "postal_code": "12345"
  }
}
```

**Response:**
```json
{
  "success": true,
  "status": "pending_payment|confirmed",
  "token": "snap_token_here",
  "redirectUrl": "https://app.sandbox.midtrans.com/snap/v1/...",
  "orderId": "order-123",
  "transactionId": "transaction-123"
}
```

### GET `/api/payments/snap?orderId=order-123`
Mengecek status pembayaran

**Response:**
```json
{
  "status": "confirmed|pending_payment|failed",
  "midtransStatus": "settlement|pending|deny",
  "orderId": "order-123"
}
```

### POST `/api/payments/midtrans-notification`
Webhook dari Midtrans untuk notifikasi pembayaran
(Dijalankan otomatis oleh Midtrans)

## 🔄 Payment Flow

### Midtrans Payment Flow
```
1. Customer di Checkout Page
   ↓
2. Select "Pembayaran Online" → Click "Pesanan Sekarang"
   ↓
3. API `/api/payments/snap` create transaction
   ↓
4. Midtrans Snap modal opens
   ↓
5. Customer complete payment
   ↓
6. Redirect to /payment-status/pending (jika pending)
   ↓
7. Auto-check status every 5 seconds
   ↓
8. Webhook notification dari Midtrans → Update status
   ↓
9. Redirect ke /payment-status/success atau /payment-status/failed
```

### COD Payment Flow
```
1. Customer di Checkout Page
   ↓
2. Select "Bayar di Tempat (COD)" → Click "Pesanan Sekarang"
   ↓
3. API `/api/payments/snap` set status to confirmed
   ↓
4. Order status updated immediately
   ↓
5. Redirect ke /payment-status/success
```

## 🐛 Bug Fixes

1. **Payment Status Not Updating**
   - Fixed: Ditambahkan real-time polling & webhook handler

2. **COD Order Not Confirmed**
   - Fixed: COD status updated instantly tanpa waiting Midtrans

3. **Payment Timeout Issues**
   - Fixed: Added expiry tracking dan better error handling

4. **Missing Payment Verification**
   - Fixed: Added Midtrans signature verification untuk security

5. **Incomplete Order Data**
   - Fixed: All order fields properly saved ke database

## 📱 Frontend Components

### Payment Status Pages
- `src/app/payment-status/success/page.tsx`
- `src/app/payment-status/pending/page.tsx`
- `src/app/payment-status/failed/page.tsx`

### Updated Components
- `src/components/checkout-page.tsx` - Improved checkout flow
- `src/app/api/payments/snap/route.ts` - Enhanced payment API
- `src/app/api/payments/midtrans-notification/route.ts` - Webhook handler

## 🛠️ Utilities & Hooks

### Payment Utils (`src/lib/payment-utils.ts`)
- `calculateShipping()` - Calculate shipping cost
- `calculateTaxAmount()` - Calculate tax
- `isValidEmail()` - Email validation
- `isValidPhoneNumber()` - Phone number validation
- `formatPhoneNumber()` - Format phone to standard
- `generateOrderId()` - Generate unique order ID
- `validatePaymentData()` - Comprehensive payment validation
- `createMidtransSnapRequest()` - Build Midtrans request

### Hooks (`src/hooks/usePaymentStatus.ts`)
- `usePaymentStatus()` - Poll payment status
- `useOrderStatusSubscription()` - Real-time Supabase updates

## 📊 Database Schema

### Orders Table (Updated)
```sql
ALTER TABLE orders ADD COLUMN:
- snap_token TEXT
- snap_redirect_url TEXT
- payment_status TEXT
- payment_confirmed_at TIMESTAMP
- expires_at TIMESTAMP
```

### Payment Notifications Table (New)
```sql
CREATE TABLE payment_notifications (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders,
  transaction_id TEXT,
  status TEXT,
  response_data JSONB,
  created_at TIMESTAMP
)
```

## 🔒 Security Measures

1. **Signature Verification** - Validasi semua webhook dari Midtrans
2. **Server-Side Validation** - Verify semua payment data di backend
3. **Rate Limiting** - Prevent brute force attempts
4. **HTTPS Only** - Ensure all payment requests encrypted
5. **Secure Keys** - Store sensitive keys di environment variables

## 🧪 Testing

### Manual Testing Midtrans
1. Use Midtrans Sandbox credentials
2. Test dengan mock payment:
   - Success: Gunakan test card
   - Failed: Gunakan invalid test card
   - Pending: Cancel atau close modal

### Testing COD
1. Select COD payment method
2. Order status should immediately be "confirmed"
3. Check `/payment-status/success`

## 📚 Additional Resources

- [Midtrans Documentation](https://docs.midtrans.com)
- [Snap Integration Guide](https://docs.midtrans.com/en/snap/overview)
- [Notification Handler](https://docs.midtrans.com/en/technical-reference/api-overview)

## ⚡ Performance Optimization

- Payment status polling berjalan setiap 5 detik (configurable)
- Database indexes untuk faster queries
- Efficient Supabase subscription untuk real-time updates
- Optimized image & asset loading

## 🚀 Deployment Checklist

- [ ] Update environment variables di production
- [ ] Set webhook URL di Midtrans production dashboard
- [ ] Change MIDTRANS_SANDBOX=false untuk production
- [ ] Test payment flow end-to-end
- [ ] Monitor webhook notifications
- [ ] Setup email notifications untuk customers
- [ ] Setup admin notification untuk payment failures
- [ ] Backup database sebelum deployment

## 📞 Support & Troubleshooting

### Payment not confirming
- Check Midtrans server key & client key
- Verify webhook URL di Midtrans dashboard
- Check logs di `/api/payments/midtrans-notification`

### COD not working
- Ensure `NEXT_PUBLIC_COD_ENABLED=true`
- Check order status di database

### Timeout issues
- Check network connectivity
- Verify Midtrans API status
- Check polling interval settings

---

**Version:** 2.0  
**Last Updated:** August 2025  
**Author:** Kograph Store Development Team
