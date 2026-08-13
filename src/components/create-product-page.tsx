'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Save } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function CreateProductPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [discountPrice, setDiscountPrice] = useState('')
  const [stock, setStock] = useState('')
  const [category, setCategory] = useState('')
  const [weight, setWeight] = useState('')
  const [productType, setProductType] = useState<'physical' | 'digital'>('physical')
  const [digitalContent, setDigitalContent] = useState('')
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [shop, setShop] = useState<any>(null)
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (!user || !profile) {
      router.push('/')
      return
    }

    if (profile.role !== 'seller' && profile.role !== 'admin' && profile.role !== 'owner') {
      router.push('/')
      return
    }

    loadShop()
  }, [user, profile, router, authLoading])

  const loadShop = async () => {
    try {
      const { data } = await (supabase as any)
        .from('shops')
        .select('*')
        .eq('owner_id', user!.id)
        .single()

      if (data) {
        setShop(data)
      }
    } catch (error) {
      console.error('Error loading shop:', error)
    }
  }

  const uploadFile = async (file: File, bucket: 'product-images' | 'digital-products') => {
    if (!user) return
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${user.id}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
    if (error) throw error
    return bucket === 'product-images'
      ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
      : path
  }

  const handleImageUpload = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Pilih file gambar (JPG, PNG, atau WebP).')
    setUploading(true)
    try { const url = await uploadFile(file, 'product-images'); if (url) setImages((current) => [...current, url]) }
    catch { toast.error('Gagal mengunggah gambar') } finally { setUploading(false) }
  }

  const handleDigitalUpload = async (file?: File) => {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return toast.error('Ukuran file maksimal 50 MB.')
    setUploading(true)
    try { const path = await uploadFile(file, 'digital-products'); if (path) { setDigitalContent(path); toast.success('File digital berhasil diunggah') } }
    catch { toast.error('Gagal mengunggah file digital') } finally { setUploading(false) }
  }

  const handleRemoveImage = (url: string) => {
    setImages(images.filter(img => img !== url))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!shop) {
      toast.error('Anda belum memiliki toko')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await (supabase as any)
        .from('products')
        .insert({
          shop_id: shop.id,
          name,
          description,
          price: parseFloat(price),
          discount_price: discountPrice ? parseFloat(discountPrice) : null,
          discount_percentage: discountPrice ? Math.round(((parseFloat(price) - parseFloat(discountPrice)) / parseFloat(price)) * 100) : null,
          stock: parseInt(stock),
          category,
          weight: parseFloat(weight) || 0,
          product_type: productType,
          digital_delivery_content: productType === 'digital' ? digitalContent : null,
          images,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error
      
      toast.success('Produk berhasil ditambahkan!')
      router.push(`/product/${data.id}`)
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error('Gagal menambahkan produk')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) {
    return null
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Anda belum memiliki toko</p>
          <button
            onClick={() => router.push('/seller')}
            className="btn-primary"
          >
            Buat Toko
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Tambah Produk</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Informasi Produk</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Produk
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Nama produk"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field"
                  rows={4}
                  placeholder="Deskripsi produk"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Pilih kategori</option>
                  <option value="electronics">Elektronik</option>
                  <option value="fashion">Fashion</option>
                  <option value="beauty">Kecantikan</option>
                  <option value="home">Rumah Tangga</option>
                  <option value="sports">Olahraga</option>
                  <option value="food">Makanan</option>
                  <option value="books">Buku</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Harga & Stok</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Produk</label>
                <select value={productType} onChange={(e) => setProductType(e.target.value as 'physical' | 'digital')} className="input-field">
                  <option value="physical">Barang fisik (dikirim)</option>
                  <option value="digital">Produk digital (email)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga (Rp)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="input-field"
                  placeholder="100000"
                  required
                />
              </div>
              {productType === 'digital' && <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tautan file digital</label>
                <input type="file" accept=".pdf,.zip,.rar,.doc,.docx,.xls,.xlsx" onChange={(e) => handleDigitalUpload(e.target.files?.[0])} className="input-field" required={!digitalContent} disabled={uploading} />
                <p className="mt-1 text-xs text-gray-500">{digitalContent ? 'File siap dikirim otomatis setelah pembayaran terverifikasi.' : 'PDF, ZIP, dokumen, dan file digital lain, maksimal 50 MB.'}</p>
              </div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga Diskon (Rp) - Opsional
                </label>
                <input
                  type="number"
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  className="input-field"
                  placeholder="80000"
                />
              </div>
              {productType === 'physical' && <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stok
                </label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="input-field"
                  placeholder="100"
                  required
                />
              </div>}
              {productType === 'physical' && <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Berat (kg)
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="input-field"
                  placeholder="0.5"
                />
              </div>}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Gambar Produk</h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageUpload(e.target.files?.[0])} className="input-field flex-1" disabled={uploading} />
                <span className="text-sm text-gray-500 self-center">{uploading ? 'Mengunggah…' : 'JPG, PNG, WebP'}</span>
              </div>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((url, index) => (
                    <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={url}
                        alt={`Product ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(url)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Save size={18} />
            {loading ? 'Menyimpan...' : 'Simpan Produk'}
          </button>
        </form>
      </div>
    </div>
  )
}
