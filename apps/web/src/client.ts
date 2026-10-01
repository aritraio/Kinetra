import type { AppRouter } from '@kinetra/api/router';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { webEnvironment } from './env';
import { accessToken } from './auth';
export const rpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${webEnvironment.VITE_API_BASE_URL}/trpc`,
      async headers() {
        const token = await accessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
