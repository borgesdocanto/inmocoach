import Image from 'next/image';
import Head from 'next/head';
import { GetStaticProps, GetStaticPaths } from 'next';
import * as cheerio from 'cheerio';

// Función para convertir URLs de video a iframe embebible
function getVideoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // YouTube - múltiples formatos
  const youtubeMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }
  
  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  
  // Si ya es un embed, devolverlo como está
  if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) {
    return url;
  }
  
  return null;
}

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
  role_title?: string | null;
  presentation_video_url?: string | null;
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
};

type PageProps = {
  data: PageData | null;
  navigationHtml: string;
  navigationStyles: string;
  error?: string;
};

export const getStaticPaths: GetStaticPaths = async () => {
  // Obtener todos los agentes visibles para generar slugs
  try {
    const res = await fetch('https://www.inmocoach.com.ar/api/agents');
    const agents = await res.json();
    
    const paths = agents.map((agent: any) => ({
      params: { slug: agent.slug },
    }));

    return {
      paths,
      fallback: 'blocking', // Generar páginas on-demand si no existen
    };
  } catch (err) {
    console.error('Error in getStaticPaths:', err);
    return {
      paths: [],
      fallback: 'blocking',
    };
  }
};

export const getStaticProps: GetStaticProps<PageProps> = async ({ params }) => {
  const { slug } = params as { slug: string };

  try {
    // 1. Fetch de datos del agente
    const agentRes = await fetch(`https://www.inmocoach.com.ar/api/agents/${slug}`);
    if (!agentRes.ok) {
      return {
        notFound: true,
      };
    }
    const data: PageData = await agentRes.json();

    // 2. Fetch del menú de galas.com.ar
    let navigationHtml = '';
    let navigationStyles = '';
    try {
      const galasRes = await fetch('https://www.galas.com.ar/', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (!galasRes.ok) throw new Error(`HTTP ${galasRes.status}`);
      const html = await galasRes.text();
      const $ = cheerio.load(html);

      let navElement = $('nav').first();
      if (!navElement.html()) {
        navElement = $('header nav').first();
      }
      navigationHtml = navElement.html() || '';

      const styleElements = $('head style');
      navigationStyles = styleElements.map((_: number, el: any) => $(el).html()).get().join('\n');
      
      console.log(`[agent-profile] menú fetched: ${navigationHtml ? navigationHtml.length : 0} bytes`);
    } catch (err: any) {
      console.error('Error fetching GALAS menu:', err?.message || err);
    }

    return {
      props: {
        data,
        navigationHtml,
        navigationStyles,
      },
      revalidate: 3600, // Revalidar cada 1 hora
    };
  } catch (err: any) {
    console.error('getStaticProps error:', err);
    return {
      props: {
        data: null,
        navigationHtml: '',
        navigationStyles: '',
        error: err?.message || 'Error loading agent',
      },
      revalidate: 300,
    };
  }
};

export default function AgentCardPage({ data, navigationHtml, navigationStyles, error }: PageProps) {
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Agente no encontrado</h1>
          <p className="text-gray-600 mb-4">{error || 'No pudimos encontrar a este agente'}</p>
          <a href="/agents" className="text-galas-red hover:underline">
            Ver todos los agentes
          </a>
        </div>
      </div>
    );
  }

  const { profile, properties } = data;

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
        {/* Inyectar estilos del menú de GALAS */}
        {navigationStyles && (
          <style dangerouslySetInnerHTML={{ __html: navigationStyles }} />
        )}
      </Head>

      <div className="min-h-screen bg-white">
        {/* Menú dinámico de GALAS (sincronizado cada hora) */}
        {navigationHtml && (
          <nav className="border-b border-gray-200">
            <div dangerouslySetInnerHTML={{ __html: navigationHtml }} />
          </nav>
        )}

        {/* Header con foto */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">
              {/* Foto - fondo blanco, sin cortes */}
              <div className="flex-shrink-0">
                <div className="relative w-40 h-40 bg-white rounded-full overflow-hidden border-4 border-galas-red shadow-lg flex items-center justify-center">
                  {profile.photo_url ? (
                    <Image
                      src={profile.photo_url}
                      alt={profile.name}
                      fill
                      className="object-contain object-center p-2"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-white text-galas-red text-4xl font-bold">
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
                {profile.role_title && (
                  <p className="text-lg text-galas-red font-semibold mb-4">
                    {profile.role_title}
                  </p>
                )}
                <p className="text-gray-700 mb-6 leading-relaxed max-w-2xl">
                  {profile.bio}
                </p>

                {/* Contacto */}
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  {profile.phone && (
                    <a
                      href={`tel:${profile.phone}`}
                      className="inline-flex items-center space-x-2 bg-galas-red hover:bg-galas-dark text-white px-4 py-2 rounded-lg"
                    >
                      <span>📱 Llamar</span>
                    </a>
                  )}
                  {profile.email_contact && (
                    <a
                      href={`mailto:${profile.email_contact}`}
                      className="inline-flex items-center space-x-2 bg-galas-red hover:bg-galas-dark text-white px-4 py-2 rounded-lg"
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
                      className="text-galas-dark hover:text-galas-dark text-2xl"
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

        {/* Video de presentación */}
        {profile.presentation_video_url && (
          <div className="bg-gray-50 border-t border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Presentación de {profile.name.split(' ')[0]}
              </h2>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
                  src={getVideoEmbedUrl(profile.presentation_video_url) || ''}
                  title={`Presentación de ${profile.name}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}

        {/* CTA especial para Team Leaders - Unirse al equipo */}
        {profile.email === 'luciana@galas.com.ar' && (
          <div className="bg-galas-light border-2 border-galas-red">
            <div className="max-w-4xl mx-auto px-4 py-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  ¿Te gustaría formar parte de nuestro equipo?
                </h3>
                <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
                  Sumate a GALAS y crecé con profesionales comprometidos en el mercado inmobiliario de la zona oeste. Tenemos oportunidades para agentes, corredores y asesores.
                </p>
                <a
                  href="https://www.galas.com.ar/unite"
                  className="inline-block bg-galas-red hover:bg-galas-dark text-white font-bold py-3 px-8 rounded-lg transition"
                >
                  Conocé cómo unirte →
                </a>
              </div>
            </div>
          </div>
        )}

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
                  href={prop.propertyUrl || `https://propiedades.galas.com.ar/p/${prop.tokko_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition overflow-hidden border border-gray-200 h-full flex flex-col cursor-pointer">
                    {/* Imagen o placeholder - fondo blanco, foto centrada sin cortes */}
                    <div className="relative bg-white h-48 flex items-center justify-center overflow-hidden group-hover:bg-gray-50 transition">
                      {prop.photoUrl ? (
                        <>
                          <img
                            src={prop.photoUrl}
                            alt={prop.address}
                            className="h-full w-auto object-contain"
                            onError={(e) => {
                              // Si la foto falla, mostrar placeholder
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          {/* Overlay hover con contador */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                            <span className="text-white font-medium text-sm bg-black/60 px-3 py-1 rounded">
                              {prop.photos_count} fotos
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center">
                          <div className="text-5xl mb-2">🏠</div>
                          <span className="text-gray-500 font-medium text-sm">
                            {prop.photos_count} fotos
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info de la propiedad */}
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="text-gray-800 font-bold mb-2 group-hover:text-galas-red transition">
                        {prop.address}
                      </p>

                      {prop.price && (
                        <p className="text-2xl font-bold text-galas-red mb-2">
                          {prop.currency === 'USD' ? 'USD ' : '$ '}{' '}
                          {prop.price.toLocaleString('es-AR')}
                        </p>
                      )}

                      {/* Sin fecha de actualización */}

                      {/* CTA Button */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <span className="inline-block bg-galas-red group-hover:bg-galas-dark text-white px-3 py-2 rounded text-sm font-medium transition w-full text-center">
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
              href="https://propiedades.galas.com.ar/Propiedades"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-galas-dark hover:bg-galas-dark text-white px-8 py-3 rounded-lg font-medium text-lg"
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
