import type { HTMLAttributes } from 'react';

export function StickyActionBar({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`sticky-action-bar ${className}`.trim()} {...props} />;
}
