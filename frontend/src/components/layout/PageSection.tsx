import type { HTMLAttributes, ReactNode } from 'react';

export function PageSection({
  title,
  description,
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLElement> & { title?: ReactNode; description?: ReactNode }) {
  return (
    <section className={`page-section ${className}`.trim()} {...props}>
      {(title || description) && (
        <div className="section-heading">
          {title && <h2>{title}</h2>}
          {description && <p>{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
