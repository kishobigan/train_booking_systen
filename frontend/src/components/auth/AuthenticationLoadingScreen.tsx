export function AuthenticationLoadingScreen({
  message = 'Restoring your secure session…',
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  return (
    <div className="auth-loading" role="status">
      <div className="auth-loading-mark" />
      <h1>Railway Operations</h1>
      <p>{message}</p>
      {retry && (
        <button className="button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
