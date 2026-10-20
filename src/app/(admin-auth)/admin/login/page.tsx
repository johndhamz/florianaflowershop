import type { Metadata } from "next";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ivory px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo size="lg" className="mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Staff sign in</p>
        </div>
        <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Access is limited to Floriana Flowers staff. Need help? Ask the shop owner.
        </p>
      </div>
    </div>
  );
}
