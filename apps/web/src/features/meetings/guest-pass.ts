import { createContext, use } from "react";

export const GuestPassContext = createContext<string | undefined>(undefined);

export const useGuestPass = () => {
  const guest = use(GuestPassContext);
  return guest ? { guest } : {};
};
