import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/60 px-6 py-8 text-center">
      <AlertTriangle className="h-7 w-7 text-red-600" />
      <p className="mt-2 text-sm font-medium text-red-900">{message}</p>
      {onRetry && (
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
