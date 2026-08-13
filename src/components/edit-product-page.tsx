'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, X, Trash2, Power } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function EditProductPage({ productId }: { productId: string }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [discountPrice, setDiscountPrice] = useState('')
  const [stock, setStock] = useState('')
  const [category, setCategory] = useState('')
  const [weight, setWeight] = useState('')
  const [productType, setProductType] = useState<'physical' | 'digital'>('physical')
  const [digitalContent, setDigitalContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (!user || !profile) {
      router.push('/')
      return
    }

    loadProduct()
  }, [user, profile, authLoading, productId, router])

  const loadProduct = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error || !data) {
        toast.error('Produk tidak ditemukan')
        router.push('/seller')
        return
      }

      const isOwner = data.shop_id && profile?.role && ['seller', 'admin', 'owner'].includes(profile.role)
      if (!isOwner) {
        toast.error('Anda tidak memiliki akses untuk mengedit produk ini')
        router.push('/seller')
        return
      }

      setName(data.name || '')
      setDescription(data.description || '')
      setPrice(String(data.price ?? ''))
      setDiscountPrice(data.discount_price ? String(data.discount_price) : '')
      setStock(String(data.stock ?? ''))
      setCategory(data.category || '')
      setWeight(data.weight ? String(data.weight) : '')
      setProductType(data.product_type || 'physical')
      setDigitalContent(data.digital_delivery_content || '')
      setImages(data.images || [])
      setIsActive(data.is_active !== false)
    } catch (error) {
      console.error('Error loading product:', error)
      toast.error('Gagal memuat produk')
    } finally {
      setLoading(false)
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
    try {
      const url = await uploadFile(file, 'product-images')
      if (url) setImages((current) => [...current, url])
    } catch (error) {
      console.error(error)
      toast.error('Gagal mengunggah gambar')
    } finally {
      setUploading(false)
    }
  }

  const handleDigitalUpload = async (file?: File) => {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return toast.error('Ukuran file maksimal 50 MB.')
    setUploading(true)
    try {
      const path = await uploadFile(file, 'digital-products')
      if (path) {
        setDigitalContent(path)
        toast.success('File digital berhasil diunggah')
      }
    } catch (error) {
      console.error(error)
      toast.error('Gagal mengunggah file digital')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload: any = {
        name,
        description,
        price: Number(price),
        discount_price: discountPrice ? Number(discountPrice) : null,
        discount_percentage: discountPrice && Number(price) > 0
          ? Math.round(((Number(price) - Number(discountPrice)) / Number(price)) * 100)
          : null,
        stock: Number(stock),
        category,
        weight: Number(weight) || 0,
        product_type: productType,
        digital_delivery_content: productType === 'digital' ? digitalContent : null,
        images,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      }

      const { error } = await (supabase as any)
        .from('products')
        .update(payload)
        .eq('id', productId)

      if (error) throw error

      toast.success('Produk berhasil diperbarui!')
      router.push('/seller')
    } catch (error) {
      console.error('Update product error:', error)
      toast.error('Gagal memperbarui produk')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!confirm('Yakin ingin nonaktifkan produk ini?')) return
    setDeleting(true)
    try {
      const { error } = await (supabase as any)
        .from('products')
        .update({ is_active: !isActive, updated_at: new Date().toISOString() })
        .eq('id', productId)

      if (error) throw error
      toast.success(isActive ? 'Produk berhasil dinonaktifkan' : 'Produk berhasil diaktifkan')
      setIsActive(!isActive)
    } catch (error) {
      console.error('Deactivate error:', error)
      toast.error('Gagal mengubah status produk')
    } finally {
      setDeleting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.')) return
    setDeleting(true)
    try {
      const { error } = await (supabase as any)
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error
      toast.success('Produk berhasil dihapus')
      router.push('/seller')
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Gagal menghapus produk')
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Produk</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field" required>
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

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Produk</label>
              <select value={productType} onChange={(e) => setProductType(e.target.value as 'physical' | 'digital')} className="input-field">
                <option value="physical">Barang fisik</option>
                <option value="digital">Produk digital</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp)</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input-field" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Harga Diskon (Rp) - Opsional</label>
              <input type="number" value={discountPrice} onChange={(e) => setDiscountPrice(e.target.value)} className="input-field" />
            </div>

            {productType === 'physical' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok</label>
                  <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="input-field" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Berat (kg)</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="input-field" />
                </div>
              </>
            )}

            {productType === 'digital' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Digital</label>
                <input type="file" accept=".pdf,.zip,.rar,.doc,.docx,.xls,.xlsx" onChange={(e) => handleDigitalUpload(e.target.files?.[0])} className="input-field" disabled={uploading} />
                <p className="mt-1 text-xs text-gray-500">{digitalContent ? 'File digital siap dikirim ke email pelanggan.' : 'Upload file digital untuk penerimaan otomatis.'}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
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
                      <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setImages((current) => current.filter((image) => image !== url))} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-3">
            <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              <Save size={18} />
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>

            <button type="button" onClick={handleDeactivate} disabled={deleting} className="w-full px-4 py-2 border border-yellow-300 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition flex items-center justify-center gap-2">
              <Power size={18} />
              {isActive ? 'Nonaktifkan Produk' : 'Aktifkan Produk'}
            </button>

            <button type="button" onClick={handleDelete} disabled={deleting} className="w-full px-4 py-2 border border-red-300 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition flex items-center justify-center gap-2">
              <Trash2 size={18} />
              {deleting ? 'Menghapus...' : 'Hapus Produk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
