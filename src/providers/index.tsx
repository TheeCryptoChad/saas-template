"use client";

import { HeroUIProvider } from "@heroui/react";
import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { ToastContainer } from "react-toastify";
import { ReactNode, FC } from "react";
import { SessionProvider } from "next-auth/react";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/lib/trpc/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Move trpc creation outside of component to avoid re-creation
export const trpc = createTRPCReact<AppRouter>();

export function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const AppProviders: FC<{ children: ReactNode }> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: {
            onSuccess: () => {
              // toast.dismiss();
            },
            onMutate: () => {
              toast.dismiss();
              toast.loading("just a moment...");
            },
            onError: (error: any) => {
              toast.dismiss();
              toast.error(error.message || "An error occurred");
              // console.error("Error caught:", error); // Debug log
            },
            onSettled: () => {
              toast.dismiss();
            },
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
      transformer: superjson,
    })
  );

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            attribute="class"
            // enableSystem={false}
            defaultTheme="dark"
            // storageKey="theme"
          >
            <HeroUIProvider>
              {children}
              <ToastContainer
                position="bottom-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
                limit={1}
              />
            </HeroUIProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
};
