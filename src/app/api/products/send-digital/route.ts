import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { generateReceiptPDF } from '@/lib/pdf-generator'

export const runtime = 'nodejs'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return new NextResponse('Server belum dikonfigurasi', { status: 503 })
  }

  try {
    const { orderId } = await request.json()
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Get order details
    const { data: order } = await admin
      .from('orders')
      .select(`
        *,
        user:profiles(email, full_name),
        shop:shops(name)
      `)
      .eq('id', orderId)
      .single()

    if (!order) {
      return new NextResponse('Order tidak ditemukan', { status: 404 })
    }

    // Get order items
    const { data: orderItems } = await admin
      .from('order_items')
      .select(`
        *,
        product:products(
          id,
          name,
          price,
          product_type,
          digital_delivery_content
        )
      `)
      .eq('order_id', orderId)

    if (!orderItems) {
      return new NextResponse('Order items tidak ditemukan', { status: 404 })
    }

    // Filter digital products
    const digitalProducts = orderItems.filter(
      (item: any) => item.product?.product_type === 'digital'
    )

    if (digitalProducts.length === 0) {
      return NextResponse.json({
        message: 'Tidak ada produk digital dalam pesanan ini',
      })
    }

    // Prepare email with digital products
    const digitalLinks = digitalProducts.map((item: any) => ({
      name: item.product.name,
      link: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/digital-products/${item.product.digital_delivery_content}`,
    }))

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Terima kasih telah berbelanja!</h2>
          
          <p style="color: #666; font-size: 14px;">
            Halo <strong>${order.user.full_name}</strong>,
          </p>
          
          <p style="color: #666; font-size: 14px;">
            Pesanan Anda telah dibayar. Berikut adalah produk digital Anda:
          </p>
          
          <div style="margin: 20px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
            <h3 style="color: #333; margin-top: 0;">📥 Produk Digital Anda:</h3>
            ${digitalLinks
              .map(
                (p: any) => `
              <div style="margin: 10px 0;">
                <a href="${p.link}" style="color: #007bff; text-decoration: none; font-weight: bold;">
                  📦 ${p.name}
                </a>
                <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">Klik link untuk mengunduh</p>
              </div>
            `
              )
              .join('')}
          </div>
          
          <div style="margin: 20px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
            <h3 style="color: #333; margin-top: 0;">📋 Rincian Pesanan:</h3>
            <p style="color: #666; font-size: 14px; margin: 8px 0;">
              <strong>Nomor Pesanan:</strong> ${order.id.slice(0, 8).toUpperCase()}
            </p>
            <p style="color: #666; font-size: 14px; margin: 8px 0;">
              <strong>Toko:</strong> ${order.shop.name}
            </p>
            <p style="color: #666; font-size: 14px; margin: 8px 0;">
              <strong>Total Pembayaran:</strong> Rp ${order.total_amount.toLocaleString('id-ID')}
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; border-top: 1px solid #ddd; padding-top: 20px;">
            Silakan periksa lampiran untuk melihat resi pembelian lengkap dalam format PDF.
          </p>
          
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            © 2025 Kograph Store. Semua hak dilindungi.
          </p>
        </div>
      </div>
    `

    // Generate PDF receipt
    const pdfBuffer = generateReceiptPDF({
      orderId: order.id,
      orderDate: new Date(order.created_at).toLocaleDateString('id-ID'),
      status: order.status,
      customerName: order.user.full_name,
      customerEmail: order.user.email,
      shopName: order.shop.name,
      items: orderItems.map((item: any) => ({
        name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      subtotal: order.subtotal,
      shippingCost: order.shipping_cost || 0,
      taxAmount: order.tax_amount || 0,
      discountAmount: order.discount_amount || 0,
      totalAmount: order.total_amount,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
    })

    // Send email with receipt PDF
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: order.user.email,
      subject: `Pesanan Anda Telah Dibayar - ${order.id.slice(0, 8).toUpperCase()}`,
      html: emailHtml,
      attachments: [
        {
          filename: `Receipt-${order.id.slice(0, 8)}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })

    // Mark as delivered for digital products
    await admin
      .from('orders')
      .update({ status: 'delivered', updated_at: new Date().toISOString() })
      .eq('id', orderId)

    return NextResponse.json({
      success: true,
      message: 'Email dengan produk digital berhasil dikirim',
    })
  } catch (error) {
    console.error('Error sending digital products:', error)
    return new NextResponse('Gagal mengirim produk digital', { status: 500 })
  }
}


