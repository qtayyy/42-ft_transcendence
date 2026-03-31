export const apiFetch = (url: string, options: RequestInit = {}) => {
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(options.headers || {}),
    },
  });
};
