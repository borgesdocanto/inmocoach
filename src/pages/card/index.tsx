import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function CardRootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir a /agents en el subdominio
    router.push('/agents');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-600">Redirigiendo...</p>
    </div>
  );
}
