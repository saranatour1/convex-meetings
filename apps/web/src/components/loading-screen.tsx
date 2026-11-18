export const LoadingScreen = ({ label = "Loading…" }: { label?: string }) => (
  <div className="grid h-dvh place-items-center text-muted-foreground text-sm">{label}</div>
);
