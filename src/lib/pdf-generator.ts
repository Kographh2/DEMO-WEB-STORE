import PDFDocument from 'pdfkit'

interface ReceiptData {
  orderId: string
  orderDate: string
  status: string
  customerName: string
  customerEmail: string
  shopName: string
  items: Array<{
    name: string
    quantity: number
    price: number
    subtotal: number
  }>
  subtotal: number
  shippingCost: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  paymentMethod: string
  paymentStatus: string
}

export function generateReceiptPDF(data: ReceiptData): Buffer {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
  })

  const chunks: Buffer[] = []

  doc.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
  })

  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('KOGRAPH STORE', { align: 'center' })
  doc.fontSize(12).font('Helvetica').text('Toko Online Terpercaya', { align: 'center' })
  doc.moveDown(0.5)

  // Title
  doc.fontSize(16).font('Helvetica-Bold').text('RESI PEMBELIAN', { align: 'center' })
  doc.moveDown(1)

  // Order Info
  doc.fontSize(10).font('Helvetica')
  doc.text(`Nomor Pesanan: ${data.orderId}`, 50, doc.y)
  doc.text(`Tanggal: ${data.orderDate}`, 50, doc.y)
  doc.text(`Status: ${data.status}`, 50, doc.y)
  doc.moveDown(1)

  // Customer Info
  doc.fontSize(11).font('Helvetica-Bold').text('DETAIL PEMBELI')
  doc.fontSize(10).font('Helvetica')
  doc.text(`Nama: ${data.customerName}`)
  doc.text(`Email: ${data.customerEmail}`)
  doc.moveDown(1)

  // Shop Info
  doc.fontSize(11).font('Helvetica-Bold').text('DETAIL TOKO')
  doc.fontSize(10).font('Helvetica')
  doc.text(`Toko: ${data.shopName}`)
  doc.moveDown(1)

  // Items
  doc.fontSize(11).font('Helvetica-Bold').text('PRODUK YANG DIBELI')
  doc.fontSize(10).font('Helvetica')

  // Table header
  const tableTop = doc.y
  const col1 = 50
  const col2 = 300
  const col3 = 400
  const col4 = 480

  doc.font('Helvetica-Bold')
  doc.text('Produk', col1, tableTop)
  doc.text('Qty', col2, tableTop)
  doc.text('Harga', col3, tableTop)
  doc.text('Subtotal', col4, tableTop)

  doc.font('Helvetica')
  let yPosition = tableTop + 20

  data.items.forEach((item) => {
    doc.text(item.name, col1, yPosition)
    doc.text(String(item.quantity), col2, yPosition)
    doc.text(`Rp ${item.price.toLocaleString('id-ID')}`, col3, yPosition)
    doc.text(`Rp ${item.subtotal.toLocaleString('id-ID')}`, col4, yPosition)
    yPosition += 20
  })

  doc.moveDown(2)

  // Summary
  doc.fontSize(11).font('Helvetica-Bold').text('RINGKASAN')
  doc.fontSize(10).font('Helvetica')

  const summaryLeft = 50
  const summaryRight = 400

  doc.text('Subtotal:', summaryLeft, doc.y)
  doc.text(`Rp ${data.subtotal.toLocaleString('id-ID')}`, summaryRight, doc.y - 10)

  doc.text('Ongkir:', summaryLeft, doc.y + 10)
  doc.text(`Rp ${data.shippingCost.toLocaleString('id-ID')}`, summaryRight, doc.y)

  doc.text('Pajak:', summaryLeft, doc.y + 10)
  doc.text(`Rp ${data.taxAmount.toLocaleString('id-ID')}`, summaryRight, doc.y)

  doc.text('Diskon:', summaryLeft, doc.y + 10)
  doc.text(`-Rp ${data.discountAmount.toLocaleString('id-ID')}`, summaryRight, doc.y)

  // Total line
  doc.moveTo(50, doc.y + 15).lineTo(550, doc.y + 15).stroke()

  doc.font('Helvetica-Bold')
  doc.text('TOTAL:', summaryLeft, doc.y + 20)
  doc.text(
    `Rp ${data.totalAmount.toLocaleString('id-ID')}`,
    summaryRight,
    doc.y - 10,
    { align: 'right' }
  )

  doc.moveDown(2)

  // Payment Info
  doc.fontSize(10).font('Helvetica')
  doc.text(`Metode Pembayaran: ${data.paymentMethod === 'midtrans' ? 'Midtrans' : 'COD'}`)
  doc.text(`Status Pembayaran: ${data.paymentStatus}`)

  doc.moveDown(2)

  // Footer
  doc.fontSize(9).font('Helvetica').text(
    'Terima kasih telah berbelanja! © 2025 Kograph Store',
    { align: 'center' }
  )

  doc.end()

  return Buffer.concat(chunks)
}
