-- Tabla de plantillas de firma
CREATE TABLE IF NOT EXISTS firma_plantillas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  docuseal_template_id bigint, -- ID del template en DocuSeal (se completa cuando se crea en DocuSeal)
  campos jsonb NOT NULL DEFAULT '[]', -- array de {nombre, tipo, requerido, etiqueta}
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de documentos enviados para firma
CREATE TABLE IF NOT EXISTS firma_documentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_email text NOT NULL REFERENCES subscriptions(email) ON DELETE CASCADE,
  plantilla_id uuid REFERENCES firma_plantillas(id),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'firmado', 'vencido', 'cancelado')),
  datos_json jsonb NOT NULL DEFAULT '{}', -- campos completados por el inmobiliario
  docuseal_submission_id bigint, -- ID de la submission en DocuSeal
  docuseal_slug text, -- slug para tracking
  firmante_nombre text,
  firmante_email text,
  firmante_telefono text,
  url_documento_firmado text,
  created_at timestamptz DEFAULT now(),
  signed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  notificacion_enviada boolean DEFAULT false
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_firma_documentos_usuario ON firma_documentos(usuario_email);
CREATE INDEX IF NOT EXISTS idx_firma_documentos_estado ON firma_documentos(estado);
CREATE INDEX IF NOT EXISTS idx_firma_documentos_docuseal ON firma_documentos(docuseal_submission_id);

-- Plantillas iniciales (sin docuseal_template_id, se agregarán después)
INSERT INTO firma_plantillas (nombre, descripcion, campos) VALUES
(
  'Boleto de Reserva',
  'Reserva de inmueble con seña',
  '[
    {"nombre": "vendedor_nombre", "etiqueta": "Nombre del vendedor", "tipo": "text", "requerido": true},
    {"nombre": "vendedor_dni", "etiqueta": "DNI del vendedor", "tipo": "text", "requerido": true},
    {"nombre": "comprador_nombre", "etiqueta": "Nombre del comprador", "tipo": "text", "requerido": true},
    {"nombre": "comprador_dni", "etiqueta": "DNI del comprador", "tipo": "text", "requerido": true},
    {"nombre": "inmueble_domicilio", "etiqueta": "Domicilio del inmueble", "tipo": "text", "requerido": true},
    {"nombre": "precio_venta", "etiqueta": "Precio de venta", "tipo": "number", "requerido": true},
    {"nombre": "moneda", "etiqueta": "Moneda", "tipo": "select", "opciones": ["USD", "ARS"], "requerido": true},
    {"nombre": "senia_monto", "etiqueta": "Monto de seña", "tipo": "number", "requerido": true},
    {"nombre": "fecha_escritura", "etiqueta": "Fecha estimada de escritura", "tipo": "date", "requerido": false},
    {"nombre": "clausulas_adicionales", "etiqueta": "Cláusulas adicionales", "tipo": "textarea", "requerido": false}
  ]'
),
(
  'Mandato de Venta',
  'Autorización del propietario para comercializar el inmueble',
  '[
    {"nombre": "propietario_nombre", "etiqueta": "Nombre del propietario", "tipo": "text", "requerido": true},
    {"nombre": "propietario_dni", "etiqueta": "DNI del propietario", "tipo": "text", "requerido": true},
    {"nombre": "propietario_cuit", "etiqueta": "CUIT del propietario", "tipo": "text", "requerido": false},
    {"nombre": "propietario_domicilio", "etiqueta": "Domicilio del propietario", "tipo": "text", "requerido": true},
    {"nombre": "inmueble_domicilio", "etiqueta": "Domicilio del inmueble", "tipo": "text", "requerido": true},
    {"nombre": "precio_venta", "etiqueta": "Precio de venta", "tipo": "number", "requerido": true},
    {"nombre": "moneda", "etiqueta": "Moneda", "tipo": "select", "opciones": ["USD", "ARS"], "requerido": true},
    {"nombre": "comision_porcentaje", "etiqueta": "Comisión (%)", "tipo": "number", "requerido": true},
    {"nombre": "vigencia_meses", "etiqueta": "Vigencia (meses)", "tipo": "number", "requerido": true},
    {"nombre": "exclusividad", "etiqueta": "Exclusividad", "tipo": "select", "opciones": ["Sí", "No"], "requerido": true}
  ]'
),
(
  'Contrato de Alquiler',
  'Contrato de locación de inmueble',
  '[
    {"nombre": "locador_nombre", "etiqueta": "Nombre del locador", "tipo": "text", "requerido": true},
    {"nombre": "locador_dni", "etiqueta": "DNI del locador", "tipo": "text", "requerido": true},
    {"nombre": "locador_cuit", "etiqueta": "CUIT del locador", "tipo": "text", "requerido": false},
    {"nombre": "locatario_nombre", "etiqueta": "Nombre del locatario", "tipo": "text", "requerido": true},
    {"nombre": "locatario_dni", "etiqueta": "DNI del locatario", "tipo": "text", "requerido": true},
    {"nombre": "inmueble_domicilio", "etiqueta": "Domicilio del inmueble", "tipo": "text", "requerido": true},
    {"nombre": "alquiler_inicial", "etiqueta": "Alquiler inicial (ARS)", "tipo": "number", "requerido": true},
    {"nombre": "duracion_meses", "etiqueta": "Duración (meses)", "tipo": "number", "requerido": true},
    {"nombre": "fecha_inicio", "etiqueta": "Fecha de inicio", "tipo": "date", "requerido": true},
    {"nombre": "indice_actualizacion", "etiqueta": "Índice de actualización", "tipo": "select", "opciones": ["ICL", "IPC", "Otro"], "requerido": true},
    {"nombre": "garantia_tipo", "etiqueta": "Tipo de garantía", "tipo": "select", "opciones": ["Propietario", "Seguro de caución", "Aval bancario", "Garantía personal"], "requerido": true},
    {"nombre": "deposito_meses", "etiqueta": "Depósito (meses)", "tipo": "number", "requerido": true}
  ]'
),
(
  'Recibo de Seña',
  'Comprobante de pago de seña / anticipo',
  '[
    {"nombre": "receptor_nombre", "etiqueta": "Recibido de (nombre)", "tipo": "text", "requerido": true},
    {"nombre": "receptor_dni", "etiqueta": "DNI del receptor", "tipo": "text", "requerido": true},
    {"nombre": "pagador_nombre", "etiqueta": "En concepto de (nombre pagador)", "tipo": "text", "requerido": true},
    {"nombre": "pagador_dni", "etiqueta": "DNI del pagador", "tipo": "text", "requerido": true},
    {"nombre": "monto", "etiqueta": "Monto de la seña", "tipo": "number", "requerido": true},
    {"nombre": "moneda", "etiqueta": "Moneda", "tipo": "select", "opciones": ["ARS", "USD"], "requerido": true},
    {"nombre": "forma_pago", "etiqueta": "Forma de pago", "tipo": "select", "opciones": ["Efectivo", "Transferencia", "Cheque"], "requerido": true},
    {"nombre": "inmueble_domicilio", "etiqueta": "En concepto de inmueble", "tipo": "text", "requerido": true},
    {"nombre": "fecha_pago", "etiqueta": "Fecha de pago", "tipo": "date", "requerido": true},
    {"nombre": "observaciones", "etiqueta": "Observaciones", "tipo": "textarea", "requerido": false}
  ]'
);

-- RLS: permitir a usuarios autenticados ver sus propios documentos
ALTER TABLE firma_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE firma_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firma_plantillas_read_all" ON firma_plantillas FOR SELECT USING (true);
CREATE POLICY "firma_documentos_own" ON firma_documentos FOR ALL USING (true);
