/**
 * Inicializador de Storage para Agent Cards
 * Se ejecuta automáticamente la primera vez que se necesita subir una foto
 */

import { supabaseAdmin } from '@/lib/supabase'

let bucketInitialized = false

export async function ensureAgentPhotosBucket() {
  // Si ya lo intentamos en esta sesión, no lo hacemos de nuevo
  if (bucketInitialized) {
    return true
  }

  try {
    // Intentar obtener el bucket
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    
    if (listError) {
      console.warn('[Storage] Warning listing buckets:', listError.message)
      bucketInitialized = false
      return false
    }

    const bucketExists = buckets?.some(b => b.name === 'agent-photos')

    if (bucketExists) {
      console.log('[Storage] ✅ Bucket agent-photos ya existe')
      bucketInitialized = true
      return true
    }

    // Si no existe, intentar crearlo
    console.log('[Storage] 📦 Creando bucket agent-photos...')
    
    const { data, error: createError } = await supabaseAdmin.storage.createBucket(
      'agent-photos',
      {
        public: true,
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ],
        fileSizeLimit: 5242880, // 5MB
      }
    )

    if (createError) {
      // Si ya existe, no es error
      if (createError.message?.includes('already exists')) {
        console.log('[Storage] ✅ Bucket agent-photos ya existe (detected via error)')
        bucketInitialized = true
        return true
      }

      console.error('[Storage] ❌ Error creando bucket:', createError.message)
      bucketInitialized = false
      return false
    }

    console.log('[Storage] ✅ Bucket agent-photos creado exitosamente')
    bucketInitialized = true
    return true
  } catch (error: any) {
    console.error('[Storage] ❌ Error inesperado:', error.message)
    bucketInitialized = false
    return false
  }
}
