export const LiveDot = () => (
  <span aria-hidden className="relative flex size-2 shrink-0">
    <span className="absolute size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
    <span className="relative size-2 rounded-full bg-success" />
  </span>
);
