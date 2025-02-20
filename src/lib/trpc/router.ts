import { userRouter } from "@/server/index";
import { router } from "./trpc";

export const appRouter = router({
  user: userRouter,
});

export type AppRouter = typeof appRouter;
