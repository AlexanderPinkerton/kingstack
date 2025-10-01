'use client';

import { observer } from 'mobx-react-lite';
import { useRootStore } from '@/hooks/useRootStore';
import { Badge } from '@/components/ui/badge';
import { Play } from 'lucide-react';
import { useState, useEffect } from 'react';

export const PlaygroundIndicator = observer(() => {
  const { playgroundStore } = useRootStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render during SSR to prevent hydration mismatch
  if (!isClient || !playgroundStore.isPlaygroundMode) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <Badge 
        variant="secondary" 
        className="flex items-center gap-2 bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200"
      >
        <Play className="h-3 w-3" />
        Playground Mode
      </Badge>
    </div>
  );
});
