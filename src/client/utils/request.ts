export const authHeaders = (getToken: () => string | null): Record<string, string> => {
  const token = getToken();
  return token ? { "x-settings-token": token } : {};
};

export const jsonHeaders = (getToken: () => string | null): Record<string, string> => {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) base["x-settings-token"] = token;
  return base;
};
