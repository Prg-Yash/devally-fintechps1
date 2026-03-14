import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { nextCookies } from "better-auth/next-js";
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
  sendDeleteAccountVerificationEmail,
} from "./email";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor, openAPI } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

export const auth = betterAuth({
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, url, newEmail }) => {
        await sendVerificationEmail({
          to: newEmail,
          verificationUrl: url,
        });
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendDeleteAccountVerificationEmail({ user, url });
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({
        to: user.email,
        resetPasswordUrl: url,
      });
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        verificationUrl: url,
      });
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [nextCookies(), twoFactor(), openAPI(), passkey()],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Send welcome email on sign-up
      if (ctx.path.startsWith("/sign-up")) {
        const newUser = ctx.context.newSession?.user ?? {
          name: ctx.body.name,
          email: ctx.body.email,
        };
        if (newUser != null) {
          await sendWelcomeEmail({
            to: newUser.email,
            name: newUser.name,
          });
        }
      }
    }),
  },
});
