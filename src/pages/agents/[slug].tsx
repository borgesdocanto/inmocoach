import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Head from 'next/head';

type Agent = {
  id: string;
  email: string;
  name: string;
  slug: string;
  photo_url: string | null;
  bio: string;
  phone: string;
  email_contact: string;
  instagram_url: string;
  linkedin_url: string;
  whatsapp_link: string;
  team_id: string;
};

type Property = {
  id: string;
  address: string;
  price: number;
  currency: string;
  photos_count: number;
  status: number;
  days_since_update: number;
  [key: string]: any;
};

type PageData = {
  profile: Agent;
  properties: Property[];
  team_name?: string;
};

export default function AgentCardPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/agents/${slug}`);
        if (!res.ok) throw new Error('Agent not found');
        const pageData = await res.json();
        setData(pageData);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Agente no encontrado</h1>
          <p className="text-gray-600 mb-4">{error || 'No pudimos encontrar a este agente'}</p>
          <a href="/agents" className="text-red-600 hover:underline">
            Ver todos los agentes
          </a>
        </div>
      </div>
    );
  }

  const { profile, properties, team_name } = data;

  const whatsappLink = profile.whatsapp_link
    ? `https://wa.me/${profile.whatsapp_link}`
    : null;

  return (
    <>
      <Head>
        <title>{profile.email.split('@')[0]} - Agente Inmobiliario</title>
        <meta
          name="description"
          content={profile.bio || 'Agente inmobiliario especializado'}
        />
        <meta property="og:title" content={profile.email.split('@')[0]} />
        <meta property="og:description" content={profile.bio} />
        {profile.photo_url && <meta property="og:image" content={profile.photo_url} />}
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
        {/* Header con foto */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">
              {/* Foto */}
              <div className="flex-shrink-0">
                <div className="relative w-40 h-40 bg-gray-200 rounded-full overflow-hidden border-4 border-red-600 shadow-lg">
                  {profile.photo_url ? (
                    <Image
                      src={profile.photo_url}
                      alt={profile.name}
                      fill
                      className="object-cover object-center"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-300 text-gray-600 text-4xl font-bold">
                      {profile.name[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {profile.name}
                </h1>
                {team_name && (
                  <p className="text-lg text-gray-600 mb-4">{team_name}</p>
                )}
                <p className="text-gray-700 mb-6 leading-relaxed max-w-2xl">
                  {profile.bio}
                </p>

                {/* Contacto */}
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  {profile.phone && (
                    <a
                      href={`tel:${profile.phone}`}
                      className="inline-flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                    >
                      <span>📱 Llamar</span>
                    </a>
                  )}
                  {profile.email_contact && (
                    <a
                      href={`mailto:${profile.email_contact}`}
                      className="inline-flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                    >
                      <span>✉️ Email</span>
                    </a>
                  )}
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
                    >
                      <span>💬 WhatsApp</span>
                    </a>
                  )}
                </div>

                {/* Redes sociales */}
                <div className="flex flex-wrap gap-3 justify-center md:justify-start mt-4">
                  {profile.instagram_url && (
                    <a
                      href={profile.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-600 hover:text-pink-700 text-2xl"
                      title="Instagram"
                    >
                      📷
                    </a>
                  )}
                  {profile.linkedin_url && (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-700 hover:text-red-800 text-2xl"
                      title="LinkedIn"
                    >
                      💼
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Propiedades */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Propiedades ({properties.length})
          </h2>

          {properties.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
              <p className="text-gray-600 text-lg">
                Este agente aún no tiene propiedades publicadas
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map(prop => (
                <a
                  key={prop.id}
                  href={`https://propiedades.galas.com.ar/p/${prop.tokko_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition overflow-hidden border border-gray-200 h-full flex flex-col cursor-pointer">
                    {/* Imagen placeholder */}
                    <div className="bg-gradient-to-br from-gray-300 to-gray-400 h-48 flex items-center justify-center relative overflow-hidden group-hover:from-gray-400 group-hover:to-gray-500 transition">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🏠</div>
                        <span className="text-white font-medium text-sm">
                          {prop.photos_count} fotos
                        </span>
                      </div>
                    </div>

                    {/* Info de la propiedad */}
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-gray-800 font-bold mb-2 group-hover:text-red-600 transition">
                        {prop.address}
                      </p>

                      {prop.price && (
                        <p className="text-2xl font-bold text-red-600 mb-2">
                          {prop.currency === 'USD' ? 'USD ' : '$ '}{' '}
                          {prop.price.toLocaleString('es-AR')}
                        </p>
                      )}

                      {prop.days_since_update !== undefined && (
                        <p className="text-xs text-gray-500 mb-auto">
                          Actualizado hace {prop.days_since_update} días
                        </p>
                      )}

                      {/* CTA Button */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <span className="inline-block bg-red-600 group-hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition w-full text-center">
                          Ver detalles →
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Link a todas las propiedades */}
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">
              ¿Buscás más propiedades de nuestra inmobiliaria?
            </p>
            <a
              href="https://propiedades.galas.com.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-red-700 hover:bg-red-800 text-white px-8 py-3 rounded-lg font-medium text-lg"
            >
              Ver todas las propiedades
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900 text-white text-center py-8 mt-16">
          <p className="text-gray-400">
            © 2026 GALAS Inmobiliaria. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </>
  );
}
