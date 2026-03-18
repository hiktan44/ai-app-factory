interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = "\ud83d\udce6", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-medium text-content mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-content-muted mb-6 max-w-md">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
