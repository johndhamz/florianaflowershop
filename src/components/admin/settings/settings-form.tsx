"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatManila } from "@/lib/datetime";
import { updateBusinessSettings } from "@/modules/settings/actions";

type Settings = {
  shop_name: string;
  tagline: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  same_day_cutoff: string;
  reservation_ttl_minutes: number;
  bank_transfer_hold_hours: number;
  online_payments_enabled: boolean;
  bank_transfer_enabled: boolean;
  bank_transfer_instructions: string;
  low_stock_alert_email: string;
  notifications_from_email: string;
  updated_at: string;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-6 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const s = (k: string) => String(fd.get(k) ?? "");
        startTransition(async () => {
          const res = await updateBusinessSettings({
            shop_name: s("shop_name"),
            tagline: s("tagline"),
            contact_email: s("contact_email"),
            contact_phone: s("contact_phone"),
            address: s("address"),
            same_day_cutoff: s("same_day_cutoff"),
            reservation_ttl_minutes: Number(s("reservation_ttl_minutes")),
            bank_transfer_hold_hours: Number(s("bank_transfer_hold_hours")),
            online_payments_enabled: fd.get("online_payments_enabled") === "on",
            bank_transfer_enabled: fd.get("bank_transfer_enabled") === "on",
            bank_transfer_instructions: s("bank_transfer_instructions"),
            low_stock_alert_email: s("low_stock_alert_email"),
            notifications_from_email: s("notifications_from_email"),
          });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      <Card size="sm">
        <CardHeader>
          <CardTitle className="font-sans text-base">Shop</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-name">Shop name</Label>
            <Input
              id="s-name"
              name="shop_name"
              required
              defaultValue={settings.shop_name}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-tag">Tagline</Label>
            <Input id="s-tag" name="tagline" defaultValue={settings.tagline} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-email">Contact email</Label>
            <Input
              id="s-email"
              name="contact_email"
              type="email"
              required
              defaultValue={settings.contact_email}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-phone">Contact phone</Label>
            <Input
              id="s-phone"
              name="contact_phone"
              required
              defaultValue={settings.contact_phone}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-addr">Address</Label>
            <Input id="s-addr" name="address" required defaultValue={settings.address} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-cutoff">Same-day cutoff (HH:MM, Manila)</Label>
            <Input
              id="s-cutoff"
              name="same_day_cutoff"
              type="time"
              required
              defaultValue={settings.same_day_cutoff}
            />
          </div>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="font-sans text-base">Payments &amp; holds</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="online_payments_enabled"
              defaultChecked={settings.online_payments_enabled}
            />{" "}
            Online payments (PayMongo) enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="bank_transfer_enabled"
              defaultChecked={settings.bank_transfer_enabled}
            />{" "}
            Bank / GCash transfer enabled
          </label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-ttl">Stock hold for unpaid online orders (minutes)</Label>
            <Input
              id="s-ttl"
              name="reservation_ttl_minutes"
              type="number"
              min={5}
              max={240}
              required
              defaultValue={settings.reservation_ttl_minutes}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-hold">Bank transfer hold (hours)</Label>
            <Input
              id="s-hold"
              name="bank_transfer_hold_hours"
              type="number"
              min={1}
              max={168}
              required
              defaultValue={settings.bank_transfer_hold_hours}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-instr">
              Bank transfer instructions (shown to customers)
            </Label>
            <Textarea
              id="s-instr"
              name="bank_transfer_instructions"
              rows={3}
              defaultValue={settings.bank_transfer_instructions}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-low">Low-stock alert email</Label>
            <Input
              id="s-low"
              name="low_stock_alert_email"
              type="email"
              defaultValue={settings.low_stock_alert_email}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-from">Notifications “from” address</Label>
            <Input
              id="s-from"
              name="notifications_from_email"
              defaultValue={settings.notifications_from_email}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Last saved {formatManila(settings.updated_at)}
            </p>
            <Button type="submit" disabled={pending}>
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
