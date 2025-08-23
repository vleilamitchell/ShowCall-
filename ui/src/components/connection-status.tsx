import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/serverComm';

export function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let timer: any;
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/health`, { cache: 'no-store' });
        if (!mounted) return;
        setIsConnected(res.ok);
      } catch {
        if (!mounted) return;
        setIsConnected(false);
      }
    };
    check();
    timer = setInterval(check, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  return (
    <div className="connectionStatus fixed bottom-3 right-3 z-50 flex items-center gap-2 text-xs text-muted-foreground">
      <span className={`statusDot ${isConnected == null ? 'statusDot--pending' : (isConnected ? 'statusDot--ok' : 'statusDot--bad')}`}></span>
      <span className="statusText">{isConnected == null ? 'connecting…' : (isConnected ? 'connected' : 'disconnected')}</span>
    </div>
  );
}

export default ConnectionStatus;


