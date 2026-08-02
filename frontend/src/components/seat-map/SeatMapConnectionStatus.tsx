export default function SeatMapConnectionStatus({ connected }: { connected: boolean }) { return <p role="status">{connected ? '● Live seat updates connected' : '○ Reconnecting seat updates…'}</p>; }
