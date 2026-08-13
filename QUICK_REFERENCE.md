# 🚀 Quick Reference Guide

## Struktur File Baru

```
src/
├── app/
│   ├── api/
│   │   ├── payments/
│   │   │   └── midtrans-notification/
│   │   │       └── route.ts (UPDATED - auto-send digital)
│   │   └── products/
│   │       └── send-digital/
│   │           └── route.ts (NEW - email digital products)
│   └── seller/
│       └── [id]/
│           └── page.tsx (NEW - seller profile page)
├── components/
│   ├── create-product-page.tsx (UPDATED - harga digital)
│   ├── edit-product-page.tsx (UPDATED - harga digital + actions)
│   ├── orders-page.tsx (UPDATED - status icons & colors)
│   └── product-detail-page.tsx (UPDATED - real-time reviews)
└── lib/
    └── pdf-generator.ts (NEW - PDF receipt)

supabase/
├── schema.sql (no changes)
└── migrations/
    └── 20250813_add_digital_delivery_and_follow_features.sql (NEW)

package.json (UPDATED - added pdfkit)
FEATURES_UPDATE_2025_08_13.md (NEW)
SETUP_GUIDE.md (NEW)
QUICK_REFERENCE.md (this file)
```

---

## 🔑 Key Changes Summary

### Files Modified: 4
1. `src/components/create-product-page.tsx` - Harga digital product
2. `src/components/edit-product-page.tsx` - Harga digital + deactivate/delete
3. `src/components/orders-page.tsx` - Status icons & colors
4. `src/components/product-detail-page.tsx` - Real-time reviews

### Files Created: 5
1. `src/app/seller/[id]/page.tsx` - Seller profile & follow
2. `src/app/api/products/send-digital/route.ts` - Email digital products
3. `src/lib/pdf-generator.ts` - PDF receipt generation
4. `supabase/migrations/20250813_*.sql` - Database indexes
5. Documentation files (3 files)

### Dependencies Added: 2
- `pdfkit` - PDF generation
- `@types/pdfkit` - TypeScript types

---

## 🔗 Component Flow

```
User Buys Digital Product
    ↓
Order Created → Midtrans Payment
    ↓
Midtrans Webhook (Success)
    ↓
Update Order Status → Check for Digital Products
    ↓
Call /api/products/send-digital
    ↓
Generate PDF Receipt
    ↓
Send Email with:
  - Download Links
  - PDF Receipt
  - Order Details
    ↓
Mark Order as "Delivered"
```

---

## 📱 Routes Baru

### Seller Profile
- **Route:** `/seller/[id]`
- **Component:** `src/app/seller/[id]/page.tsx`
- **Features:** View shop, products, follow, rating
- **Access:** Public

### Send Digital Products API
- **Route:** `POST /api/products/send-digital`
- **Trigger:** Midtrans webhook (automatic)
- **Manual:** Can be called manually for testing
- **Access:** Backend only

---

## 🎨 UI Components Added

### 1. Seller Profile Card
```tsx
<div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl">
  {/* Seller Logo */}
</div>
```

### 2. Follow Button
```tsx
<button onClick={handleFollowToggle}>
  {isFollowing ? (
    <>
      <UserCheck size={18} />
      Sedang Diikuti
    </>
  ) : (
    <>
      <UserPlus size={18} />
      Ikuti
    </>
  )}
</button>
```

### 3. Order Status Card
```tsx
<div className={`rounded-2xl p-4 shadow-sm border ${statusInfo.bgColor}`}>
  <div className={`p-3 rounded-full ${statusInfo.color}`}>
    <IconComponent size={24} />
  </div>
  {/* Status info */}
</div>
```

### 4. Product Action Buttons
```tsx
<div className="flex gap-3">
  <button className="btn-primary">Simpan Perubahan</button>
  <button className="bg-yellow-50">Nonaktifkan</button>
  <button className="bg-red-50">Hapus</button>
</div>
```

---

## 🔧 Database Schema

### Tabel Yang Digunakan

#### `products`
```sql
- id (UUID, primary key)
- shop_id (FK)
- name (text)
- price (numeric)
- is_active (boolean) -- untuk disable/enable
- product_type (text) -- 'physical' atau 'digital'
- digital_delivery_content (text) -- path ke file
```

#### `follows`
```sql
- id (UUID, primary key)
- follower_id (FK → profiles)
- following_id (FK → profiles)
- created_at (timestamp)
- unique(follower_id, following_id)
```

#### `orders`
```sql
- status (text) -- 'delivered' untuk digital products
- payment_status (text) -- 'paid' saat berhasil
```

#### `order_items`
```sql
- order_id (FK)
- product_id (FK)
- quantity
- price
- subtotal
```

---

## 📧 Email Template

Email yang dikirim untuk digital products:

```
Subject: Pesanan Anda Telah Dibayar - [ORDER_ID]

Body:
├─ Greeting: Halo {Nama}
├─ Status: Pesanan dibayar
├─ Section 1: Digital Products
│  ├─ Product 1 - [Download Link]
│  ├─ Product 2 - [Download Link]
│  └─ ...
├─ Section 2: Order Details
│  ├─ Order ID
│  ├─ Shop Name
│  └─ Total Amount
├─ Attachment: Receipt PDF
└─ Footer: Copyright & info
```

---

## 🔒 Security Considerations

### 1. Midtrans Webhook Validation
```typescript
const signature = createHash('sha512')
  .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
  .digest('hex')
  
if (signature !== signature_key) {
  return error("Invalid signature")
}
```

### 2. RLS Policies
- Users can only view own orders
- Sellers can only view own products
- Public can view active products only

### 3. File Access
- Digital products stored in Supabase storage with auth
- Download links require Supabase auth or public access

### 4. Email Security
- SMTP credentials in environment variables (never hardcoded)
- Sensitive data not logged

---

## 🧪 Testing Commands

### Test Digital Product Email
```bash
curl -X POST http://localhost:3000/api/products/send-digital \
  -H "Content-Type: application/json" \
  -d '{"orderId":"order-uuid-here"}'
```

### Test Seller Profile
```
Open: http://localhost:3000/seller/seller-id-here
```

### Test Follow Feature
Login with 2 users and test follow/unfollow

### Test Order Status
```
Open: http://localhost:3000/orders
Should see different colors & icons per status
```

---

## 📝 Code Examples

### 1. Subscribe to Real-time Reviews
```typescript
const subscription = supabase
  .channel(`product:${productId}:reviews`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'reviews',
    filter: `product_id=eq.${productId}`,
  }, (payload) => {
    loadProduct()
  })
  .subscribe()

return () => subscription.unsubscribe()
```

### 2. Follow/Unfollow Seller
```typescript
// Follow
await supabase.from('follows').insert({
  follower_id: user.id,
  following_id: sellerId,
})

// Unfollow
await supabase.from('follows').delete()
  .eq('follower_id', user.id)
  .eq('following_id', sellerId)
```

### 3. Generate PDF
```typescript
import { generateReceiptPDF } from '@/lib/pdf-generator'

const pdfBuffer = generateReceiptPDF({
  orderId: order.id,
  orderDate: new Date(order.created_at).toLocaleDateString('id-ID'),
  // ... other fields
})

// Send as email attachment
attachments: [{
  filename: `Receipt-${order.id}.pdf`,
  content: pdfBuffer,
  contentType: 'application/pdf',
}]
```

### 4. Deactivate Product
```typescript
const { error } = await supabase
  .from('products')
  .update({ 
    is_active: !isActive, 
    updated_at: new Date().toISOString() 
  })
  .eq('id', productId)
```

---

## 🎯 Feature Status

| Feature | Status | Tested | Notes |
|---------|--------|--------|-------|
| Digital Product Pricing | ✅ Done | Pending | Works in create & edit |
| Edit Product | ✅ Done | Pending | Full CRUD support |
| Deactivate Product | ✅ Done | Pending | Toggle on/off |
| Delete Product | ✅ Done | Pending | Permanent delete |
| Seller Profile | ✅ Done | Pending | View shop & products |
| Follow Seller | ✅ Done | Pending | Like/Unlike feature |
| Real-time Reviews | ✅ Done | Pending | Auto-refresh |
| Order Status UI | ✅ Done | Pending | Color & icons |
| Midtrans Auto-success | ✅ Done | Pending | Webhook trigger |
| Email Digital Products | ✅ Done | Pending | Auto-send on payment |
| PDF Receipt | ✅ Done | Pending | Attachment in email |

---

## 🚀 Next Steps

1. **Test all features locally**
2. **Update environment variables**
3. **Run database migration**
4. **Test email delivery**
5. **Test Midtrans webhook**
6. **Deploy to production**
7. **Monitor logs for errors**

---

## 📞 Support & Documentation

- **Setup Guide:** `SETUP_GUIDE.md`
- **Features Details:** `FEATURES_UPDATE_2025_08_13.md`
- **This Guide:** `QUICK_REFERENCE.md`

For issues:
1. Check console errors (Browser DevTools)
2. Check server logs (Terminal)
3. Verify environment variables
4. Check database connection
5. Review documentation

---

**Version:** 1.0.0
**Date:** 2025-08-13
**Status:** Ready for Testing ✅
