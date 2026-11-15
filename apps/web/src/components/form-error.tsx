export function FormError({ error }: { error: string | undefined }) {
  if (!error) return null;
  return (
    <p className="text-destructive-foreground text-sm" role="alert">
      {error}
    </p>
  );
}
