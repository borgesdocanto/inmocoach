#!/usr/bin/env node

/**
 * Script para crear el bucket agent-photos en Supabase Storage
 * 
 * Uso:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx scripts/create-storage-bucket.ts
 * 
 * O desde Vercel:
 *   vercel env pull
 *   npx tsx scripts/create-storage-bucket.ts
 */

import { createClient } from '@supabase/supabase-js'

const projectId = 'hjyyqxjzlgiywgvikzsa'
const supabaseUrl = `https://${projectId}.supabase.co`
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada')
  console.error('')
  console.error('Opciones para configurarla:')
  console.error('1. Desde terminal: export SUPABASE_SERVICE_ROLE_KEY=your_key')
  console.error('2. Desde Vercel: vercel env pull')
  console.error('3. Manualmente en Supabase UI: Storage → Create New Bucket')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function createBucket() {
  try {
    console.log('📦 Creando bucket agent-photos en Supabase Storage...')
    
    const { data, error } = await supabase.storage.createBucket('agent-photos', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      fileSizeLimit: 5242880, // 5MB
    })

    if (error && error.message.includes('already exists')) {
      console.log('✅ Bucket agent-photos ya existe')
      return
    }

    if (error) {
      console.error('❌ Error al crear bucket:', error.message)
      process.exit(1)
    }

    console.log('✅ Bucket agent-photos creado exitosamente')
    console.log('')
    console.log('Detalles:')
    console.log(`  - Nombre: agent-photos`)
    console.log(`  - Público: Sí`)
    console.log(`  - Tipos permitidos: JPG, PNG, GIF, WebP`)
    console.log(`  - Tamaño máximo: 5MB`)
  } catch (error) {
    console.error('❌ Error inesperado:', error)
    process.exit(1)
  }
}

createBucket()
