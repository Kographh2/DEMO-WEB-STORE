'use client'

import { motion } from 'framer-motion'
import { Shield, FileText, Users, Lock } from 'lucide-react'

type LegalType = 'privacy' | 'terms' | 'faq' | 'law'

const legalContent: Record<LegalType, { title: string; sections: { title: string; content: string }[] }> = {
  privacy: {
    title: 'Kebijakan Privasi',
    sections: [
      {
        title: '1. Pengumpulan Data',
        content: 'Kami mengumpulkan data pribadi yang Anda berikan secara sukarela saat mendaftar, membuat pesanan, atau menggunakan layanan kami. Data yang dikumpulkan meliputi nama, email, alamat, dan informasi pembayaran.',
      },
      {
        title: '2. Penggunaan Data',
        content: 'Data yang dikumpulkan digunakan untuk memproses pesanan, meningkatkan layanan, mengirimkan notifikasi, dan memberikan pengalaman yang lebih personal. Kami tidak akan menjual atau menyebarkan data Anda kepada pihak ketiga tanpa persetujuan Anda.',
      },
      {
        title: '3. Perlindungan Data',
        content: 'Kami menggunakan enkripsi SSL dan protokol keamanan standar industri untuk melindungi data Anda. Semua transaksi pembayaran diproses melalui gateway pembayaran yang aman.',
      },
      {
        title: '4. Hak Pengguna',
        content: 'Anda memiliki hak untuk mengakses, mengubah, atau menghapus data pribadi Anda kapan saja. Hubungi kami di privacy@kographstore.com untuk permintaan terkait data.',
      },
      {
        title: '5. Cookies',
        content: 'Kami menggunakan cookies untuk meningkatkan pengalaman browsing Anda. Anda dapat menonaktifkan cookies melalui pengaturan browser, namun beberapa fitur mungkin tidak berfungsi dengan baik.',
      },
    ],
  },
  terms: {
    title: 'Syarat dan Ketentuan',
    sections: [
      {
        title: '1. Persetujuan',
        content: 'Dengan menggunakan layanan Kograph Store, Anda setuju untuk mematuhi syarat dan ketentuan yang berlaku. Jika Anda tidak setuju, mohon untuk tidak menggunakan layanan kami.',
      },
      {
        title: '2. Akun Pengguna',
        content: 'Anda bertanggung jawab untuk menjaga kerahasiaan akun Anda. Setiap aktivitas yang terjadi di bawah akun Anda menjadi tanggung jawab Anda. Beritahu kami segera jika ada penggunaan yang tidak sah.',
      },
      {
        title: '3. Produk dan Harga',
        content: 'Kami berusaha untuk menampilkan informasi produk dan harga yang akurat. Namun, kesalahan mungkin terjadi. Kami berhak membatalkan pesanan jika ada kesalahan harga atau informasi produk.',
      },
      {
        title: '4. Pembayaran',
        content: 'Kami menerima pembayaran melalui transfer bank, e-wallet, dan COD. Pembayaran harus dilunasi dalam waktu 24 jam untuk pesanan COD.',
      },
      {
        title: '5. Pengembalian Dana',
        content: 'Produk dapat dikembalikan dalam waktu 7 hari setelah diterima jika terjadi kerusakan atau kesalahan pengiriman. Biaya pengembalian ditanggung oleh pembeli kecuali kesalahan berasal dari seller.',
      },
    ],
  },
  faq: {
    title: 'Pertanyaan yang Sering Diajukan',
    sections: [
      {
        title: 'Bagaimana cara memesan?',
        content: 'Pilih produk yang diinginkan, tambahkan ke keranjang, lalu checkout. Pilih metode pembayaran dan isi alamat pengiriman. Pesanan akan diproses setelah pembayaran dikonfirmasi.',
      },
      {
        title: 'Berapa lama pengiriman?',
        content: 'Waktu pengiriman tergantung lokasi dan jenis jasa pengiriman. Umumnya 1-3 hari kerja untuk Jabodetabek dan 3-7 hari kerja untuk luar kota.',
      },
      {
        title: 'Bagaimana sistem komisi?',
        content: 'Seller mendapatkan 97% dari harga jual, sedangkan platform mengambil 3% sebagai biaya layanan. Pajak 5% dikenakan untuk setiap transaksi.',
      },
      {
        title: 'Bagaimana cara menarik dana?',
        content: 'Seller dapat menarik dana melalui menu Withdrawal di dashboard. Minimum penarikan adalah Rp 50.000. Dana akan ditransfer ke rekening bank yang terdaftar dalam 1-3 hari kerja.',
      },
      {
        title: 'Apakah aman bertransaksi di sini?',
        content: 'Ya, semua transaksi dilindungi dengan enkripsi SSL dan sistem pembayaran yang terpercaya. Data pribadi Anda dijaga kerahasiaannya.',
      },
    ],
  },
  law: {
    title: 'Ketentuan Undang-Undang Indonesia',
    sections: [
      {
        title: '1. Yurisdiksi',
        content: 'Syarat dan ketentuan ini diatur oleh hukum Republik Indonesia. Setiap sengketa akan diselesaikan di pengadilan yang berwenang di wilayah Jakarta, Indonesia.',
      },
      {
        title: '2. UU Perlindungan Konsumen',
        content: 'Kami berkomitmen untuk melindungi hak konsumen sesuai dengan UU No. 8 Tahun 1999 tentang Perlindungan Konsumen. Konsumen berhak mendapatkan barang yang bermutu, jujur, dan tidak menyesatkan.',
      },
      {
        title: '3. UU ITE',
        content: 'Pengguna diharapkan untuk tidak menyebarkan konten yang melanggar UU No. 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik.',
      },
      {
        title: '4. UU Perdagangan',
        content: 'Semua transaksi diatur oleh UU No. 7 Tahun 2014 tentang Perdagangan. Seller wajib memberikan barang yang sesuai dengan deskripsi dan kualitas yang dijual.',
      },
      {
        title: '5. UU PPN',
        content: 'Pajak Pertambahan Nilai (PPN) 11% dan Pajak Penjualan atas Barang Mewah (PPnBM) mungkin berlaku sesuai dengan ketenturan peraturan perundang-undangan.',
      },
    ],
  },
}

export default function LegalPage({ type }: { type: LegalType }) {
  const content = legalContent[type]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={32} className="text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{content.title}</h1>
          <p className="text-gray-600">Terakhir diperbarui: Agustus 2026</p>
        </motion.div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          {content.sections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="mb-8 last:mb-0"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-3">{section.title}</h2>
              <p className="text-gray-600 leading-relaxed">{section.content}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Jika Anda memiliki pertanyaan, hubungi kami di{' '}
            <a href="mailto:support@kographstore.com" className="text-primary-600 hover:underline">
              support@kographstore.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
