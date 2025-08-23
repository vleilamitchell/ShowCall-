import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/serverComm';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/design/PageHeader';
import { Section } from '@/components/design/Section';
import { Chip } from '@/components/design/Chip';

export function Home() {
  const { user } = useAuth();
  const [serverUserInfo, setServerUserInfo] = useState(null);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    async function fetchUserInfo() {
      if (user) {
        try {
          const data = await api.getCurrentUser();
          setServerUserInfo(data);
          setServerError('');
        } catch (error) {
          setServerError('Failed to fetch user info from server');
          console.error('Server error:', error);
        }
      }
    }
    fetchUserInfo();
  }, [user]);

  return (
    <div className="p-4">
      <PageHeader>
        <h1 className="text-xl font-semibold">Welcome to Your App!</h1>
        <Chip variant="accent" className="ml-2">beta</Chip>
      </PageHeader>
      <Section title="Server User Info">
        {serverError ? (
          <p className="text-red-500">{serverError}</p>
        ) : serverUserInfo ? (
          <pre className="text-left bg-muted p-2 rounded text-sm">
            {JSON.stringify(serverUserInfo, null, 2)}
          </pre>
        ) : (
          <p>Loading server info...</p>
        )}
      </Section>
    </div>
  );
} 