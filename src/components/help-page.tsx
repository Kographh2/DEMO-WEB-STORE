'use client'

import { motion } from 'framer-motion'
import { ChevronRight, HelpCircle } from 'lucide-react'

const faqs = [
  {
    question: 'Bagaimana cara memesan?',
    answer: 'Pilih produk yang diinginkan, tambahkan ke keranjang, lalu checkout. Pilih metode pembayaran dan isi alamat pengiriman. Pesanan akan diproses setelah pembayaran dikonfirmasi.'
  },
  {
    question: 'Berapa lama pengiriman?',
    answer: 'Waktu pengiriman tergantung lokasi dan jenis jasa pengiriman. Umumnya 1-3 hari kerja untuk Jabodetabek dan 3-7 hari kerja untuk luar kota.'
  },
  {
    question: 'Bagaimana sistem komisi?',
    answer: 'Seller mendapatkan 97% dari harga jual, sedangkan platform mengambil 3% sebagai biaya layanan. Pajak 5% dikenakan untuk setiap transaksi.'
  },
  {
    question: 'Bagaimana cara menarik dana?',
    answer: 'Seller dapat menarik dana melalui menu Withdrawal di dashboard. Minimum penarikan adalah Rp 50.000. Dana akan ditransfer ke rekening bank yang terdaftar dalam 1-3 hari kerja.'
  },
  {
    question: 'Apakah aman bertransaksi di sini?',
    answer: 'Ya, semua transaksi dilindungi dengan enkripsi SSL dan sistem pembayaran yang terpercaya. Data pribadi Anda dijaga kerahasiaannya.'
  },
  {
    question: 'Bagaimana cara menjadi seller?',
    answer: 'Untuk saat ini sistem menjadi seller hanya bisa di tambahkan dan di daftarkan oleh admin, untuk mengurangi resiko penipuan, untuk price menjadi seller cukup terjangkau, silahkan hubungi Whatsapp +62 889-9111-4939 - Admin Kograph.'
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HelpCircle size={32} className="text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pusat Bantuan</h1>
          <p className="text-gray-600">Temukan jawaban untuk pertanyaan Anda</p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <ChevronRight size={16} className="text-primary-600" />
                {faq.question}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed ml-6">
                {faq.answer}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            Tidak menemukan jawaban? Hubungi kami di
          </p>
          <a
            href="mailto:support@kographstore.com"
            className="text-primary-600 font-medium hover:underline"
          >
            support@kographstore.com
          </a>
        </div>
      </div>
    </div>
  )
}
