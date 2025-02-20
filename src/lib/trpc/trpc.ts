import { initTRPC, TRPCError } from "@trpc/server";
import { type Context } from "./context";
import SuperJSON from "superjson";

export const t = initTRPC.context<Context>().create({
  transformer: SuperJSON,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isLoggedIn = t.middleware(({ ctx, next }) => {
  // console.log("Checking auth, session:", ctx.session); // Add this log

  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

// export const userProcedure = t.procedure.use(isLoggedIn);
// export const protectedProcedure = t.procedure.use(isLoggedIn);
export const protectedProcedure = t.procedure.use(isLoggedIn);
