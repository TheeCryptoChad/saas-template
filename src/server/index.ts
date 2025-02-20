import { router, publicProcedure, protectedProcedure } from "@/lib/trpc/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const userRouter = router({
  helloWorld: publicProcedure
    .input(
      z.object({
        name: z.string(),
      })
    )
    .query(async ({ input }) => {
      return {
        message: `Hello ${input.name}`,
      };
    }),
});
