import { NextAuthOptions, User, Account, Profile } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { VercelProvider } from "./authProviders/vercel";
import NeonProvider from "./authProviders/neon";
import { prisma } from "@/lib/prisma";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { GitHubInstallProvider } from "./authProviders/githubInstall";
import { GitHubOauthProvider } from "./authProviders/githubOauth";
import { JWT } from "next-auth/jwt";

const registerUser = async (user: User, account: Account, profile: Profile) => {
  if (!user.email) return false;

  const {
    provider,
    type,
    providerAccountId,
    access_token,
    expires_at,
    refresh_token,
    refresh_token_expires_in,
    token_type,
    scope,
  } = account;

  // console.log("profile: ", profile);
  // console.log("account: ", account);
  // console.log("user: ", user);

  const updateImage = async () => {
    if (!user.email) return;

    const existingUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existingUser) return;

    const existingImage = existingUser.image;

    if (existingImage === null || existingImage === undefined) {
      return { image: user.image };
    }
  };

  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: {
      ...(await updateImage()),
    },
    create: {
      email: user.email,
      name: user.name,
      image: user.image,
    },
  });

  // Create/update provider record
  try {
    await prisma.provider.upsert({
      where: {
        userId_name: {
          userId: dbUser.id,
          name: provider,
        },
      },
      update: {
        accessToken: access_token as string,
        accessTokenExpiresAt: expires_at
          ? new Date(expires_at * 1000)
          : undefined, // Convert Unix timestamp to DateTime
        refreshToken: refresh_token || undefined,

        refreshTokenExpiresAt: refresh_token_expires_in
          ? new Date((refresh_token_expires_in as number) * 1000)
          : undefined,
        tokenType: token_type,
        scope: scope || null,
        metadata:
          provider === "github_install"
            ? {
                installationId: profile.installationId as string,
                installationToken: profile.installationToken as string,
              }
            : provider === "vercel"
            ? {
                teamId: account.team_id as string,
              }
            : undefined,
      },
      create: {
        userId: dbUser.id,
        name: provider,
        providerId: providerAccountId,
        accessToken: access_token as string,
        accessTokenExpiresAt: expires_at
          ? new Date(expires_at * 1000)
          : undefined,
        refreshToken: refresh_token || undefined,
        refreshTokenExpiresAt: refresh_token_expires_in
          ? new Date((refresh_token_expires_in as number) * 1000)
          : undefined,
        tokenType: token_type as string,
        scope: scope || null,
        metadata:
          provider === "github_install"
            ? {
                installationId: profile.installationId as string,
                installationToken: profile.installationToken as string,
              }
            : provider === "vercel"
            ? {
                teamId: account.team_id as string,
              }
            : undefined,
      },
    });
    return dbUser;
  } catch (error) {
    console.error("Error in registerUser:", error);
    throw error; // Re-throw to be caught by signIn callback
  }
};

const refreshAccessToken = async (token: JWT) => {
  console.log("refreshing");
  if (!token.id) return;

  const dbuser = await prisma.user.findUnique({
    where: {
      id: token.id as string,
    },
    include: {
      providers: true,
    },
  });

  const refreshTokens: any[] = [];

  dbuser?.providers.forEach((provider) => {
    const {
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
    } = provider;

    if (!accessToken || !refreshToken || !accessTokenExpiresAt) return;

    if (accessTokenExpiresAt < new Date()) {
      refreshTokens.push({
        provider: provider.name,
        refreshToken,
      });
    }
  });

  console.log("refreshTokens: ", refreshTokens);
  return;
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET!,
  providers: [
    // GithubProvider({
    //   clientId: process.env.GITHUB_CLIENT_ID!,
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    //   authorization: {
    //     params: {
    //       scope:
    //         "repo read:user admin:repo_hook delete_repo workflow admin:org admin:public_key admin:org_hook user project notification security_events write:packages read:packages delete:packages admin:gpg_key admin:enterprise read:org write:org",
    //     },
    //   },
    // }),
    VercelProvider({
      clientId: process.env.VERCEL_CLIENT_ID!,
      clientSecret: process.env.VERCEL_CLIENT_SECRET!,
      integrationSlug: process.env.VERCEL_INTEGRATION_SLUG!,
    }),
    GitHubInstallProvider(),
    GitHubOauthProvider(),
    NeonProvider({
      clientId: process.env.NEON_CLIENT_ID!,
      clientSecret: process.env.NEON_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (user && account && profile) {
          const dbUser = await registerUser(user, account, profile);
          if (dbUser) {
            user.id = dbUser.id;

            user.image = dbUser.image;
            return true;
          }
        }
      } catch (error) {
        console.error("error signing in: ", error);
        return false;
      }
    },

    // async redirect(stuff) {
    // },
    async jwt({ user, account, profile, token }) {
      // console.log("token: ", token);
      // console.log("account: ", account);
      // console.log("user: ", user);
      // console.log("profile: ", profile);

      await refreshAccessToken(token);

      // if (account && user) {
      //   const dbUser = await prisma.user.findUnique({
      //     where: { email: user.email },
      //   });
      //   if (dbUser) {

      //     token.id = dbUser.id;
      //   }
      // }
      // token.user = user;

      // console.log("user: ", user);
      // console.log("token: ", token);

      // user, account and profile are only passed in here the first time the user signs in
      // after that, only token is passed in
      if (account && user) {
        token.id = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      // console.log("session: ", session);
      // console.log("token: ", token);
      // console.log("session: ", session);

      //just passing session as is, but adding the user id from the token
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
        },
      };
    },
  },

  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/linkAccounts",
  },
};
