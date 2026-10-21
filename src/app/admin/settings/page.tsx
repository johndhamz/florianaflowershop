import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SettingsForm } from "@/components/admin/settings/settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/dal";

export const metadata: Metadata = { title: "Settings" };

async function Settings() {
  await requireStaff("settings.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_settings")
    .select(
      "shop_name, tagline, contact_email, contact_phone, address, same_day_cutoff, reservation_ttl_minutes, bank_transfer_hold_hours, online_payments_enabled, bank_transfer_enabled, bank_transfer_instructions, low_stock_alert_email, notifications_from_email, updated_at",
    )
    .eq("id", 1)
    .single();
  if (error) throw new Error(error.message);
  return (
    <SettingsForm
      settings={{
        ...data,
        tagline: data.tagline ?? "",
        contact_phone: data.contact_phone ?? "",
        address: data.address ?? "",
        bank_transfer_instructions: data.bank_transfer_instructions ?? "",
        low_stock_alert_email: data.low_stock_alert_email ?? "",
        notifications_from_email: data.notifications_from_email ?? "",
        same_day_cutoff: data.same_day_cutoff.slice(0, 5),
      }}
    />
  );
}

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title="Settings"
        description="Shop identity, payment methods, holds and alert addresses. Delivery zones and slots have their own page."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/delivery-settings">Delivery settings</Link>
          </Button>
        }
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={2} />}>
        <Settings />
      </Suspense>
    </div>
  );
}
