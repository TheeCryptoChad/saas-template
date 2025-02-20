import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { authOptions } from "@/lib/auth/authOptions";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function createContext({
  req,
  resHeaders,
}: FetchCreateContextFnOptions) {
  const session = await getServerSession(authOptions);

  // console.log("session: ", session);

  let user;

  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: {
        id: session?.user.id,
      },
      include: {
        providers: true,
      },
    });

    if (dbUser) {
      // Transform providers array into an object
      const providers = dbUser.providers.reduce(
        (acc, provider) => ({
          ...acc,
          [provider.name]: provider,
        }),
        {} as Record<string, (typeof dbUser.providers)[0]>
      );

      // Combine user data with indexed providers
      user = {
        ...dbUser,
        providers, // Override array with indexed object
      };
    }
  }

  return {
    req,
    resHeaders,
    session,
    user,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
