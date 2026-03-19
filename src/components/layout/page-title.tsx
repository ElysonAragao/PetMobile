import type { ReactNode } from 'react';

interface PageTitleProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageTitle({ title, description, children }: PageTitleProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </div>
  );
}
