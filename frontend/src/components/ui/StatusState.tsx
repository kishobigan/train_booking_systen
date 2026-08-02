import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react';
export function LoadingState({ label = 'Loading…' }) { return <div className="state" role="status"><LoaderCircle className="spin" />{label}</div>; }
export function EmptyState({ title = 'Nothing here yet', message }: { title?: string; message?: string }) { return <div className="state"><Inbox /><strong>{title}</strong>{message && <span>{message}</span>}</div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="state state-error" role="alert"><AlertTriangle /><strong>Unable to load</strong><span>{message}</span>{retry && <button className="button button-secondary" onClick={retry}>Try again</button>}</div>; }
