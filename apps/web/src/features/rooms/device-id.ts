const KEY = "meetings:device";

export const deviceId = () => {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved) return saved;
    const created = crypto.randomUUID();
    window.localStorage.setItem(KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
};
