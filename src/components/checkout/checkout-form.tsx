"use client";

import { Loader2Icon, LockIcon, TagIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCentavos } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Cart } from "@/modules/cart/types";
import {
  checkPromoCode,
  getDeliveryOptions,
  placeOrder,
} from "@/modules/checkout/actions";
import { checkoutSchema, flattenIssues } from "@/modules/checkout/schema";
import type { DeliveryOptions, PromoCheck } from "@/modules/checkout/types";

type Zone = {
  id: string;
  name: string;
  city: string;
  barangays: string[];
  feeCentavos: number;
  freeDeliveryThresholdCentavos: number | null;
  minOrderCentavos: number;
  sameDayCutoff: string | null;
};

type Props = {
  cart: Cart;
  zones: Zone[];
  paymentMethods: { paymongo: boolean; bank_transfer: boolean };
};

const field = "h-10 bg-card";
const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function todayManila() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}
function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function CheckoutForm({ cart, zones, paymentMethods }: Props) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [barangay, setBarangay] = useState("");
  const [date, setDate] = useState(addDays(todayManila(), 1));
  const [slotId, setSlotId] = useState("");
  const [options, setOptions] = useState<(DeliveryOptions & { key: string }) | null>(
    null,
  );
  const optionsKey = `${zoneId}:${date}`;
  const loadingSlots = !options || options.key !== optionsKey;
  const [promoInput, setPromoInput] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [promo, setPromo] = useState<PromoCheck | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"paymongo" | "bank_transfer">(
    paymentMethods.paymongo ? "paymongo" : "bank_transfer",
  );

  const zone = zones.find((z) => z.id === zoneId);
  const goods = cart.subtotal_centavos + cart.add_ons_centavos;
  const discount = promo?.valid ? promo.discount_centavos : 0;
  const fee = zone
    ? zone.freeDeliveryThresholdCentavos !== null &&
      goods >= zone.freeDeliveryThresholdCentavos
      ? 0
      : zone.feeCentavos
    : 0;
  const total = goods + fee - discount;
  const belowMin = zone ? goods < zone.minOrderCentavos : false;

  // Load slots whenever zone/date change.
  useEffect(() => {
    if (!zoneId || !date) return;
    let cancelled = false;
    const key = `${zoneId}:${date}`;
    getDeliveryOptions(zoneId, date).then((res) => {
      if (cancelled) return;
      setOptions({ ...res, key });
      setSlotId((current) =>
        res.slots?.some((s) => s.slot_id === current && s.available)
          ? current
          : (res.slots?.find((s) => s.available)?.slot_id ?? ""),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [zoneId, date]);

  const barangayQuery = barangay.trim().toLowerCase();
  const barangaySuggestions =
    zone && barangayQuery
      ? zone.barangays
          .filter((b) => b.toLowerCase().startsWith(barangayQuery))
          .slice(0, 6)
      : [];

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setCheckingPromo(true);
    const emailField = formRef.current?.elements.namedItem("sender.email");
    const email = emailField instanceof HTMLInputElement ? emailField.value : undefined;
    const res = await checkPromoCode(promoInput.trim(), goods, email);
    setPromo(res);
    setCheckingPromo(false);
    if (!res.valid) setErrors((e) => ({ ...e, promo_code: res.message }));
    else setErrors(({ promo_code: _ignored, ...rest }) => rest);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const str = (key: string) => String(data.get(key) ?? "");
    const raw = {
      sender: {
        name: str("sender.name"),
        email: str("sender.email"),
        phone: str("sender.phone"),
      },
      recipient: {
        name: str("recipient.name"),
        phone: str("recipient.phone"),
        address_line1: str("recipient.address_line1"),
        address_line2: str("recipient.address_line2"),
        barangay: str("recipient.barangay"),
        postal_code: str("recipient.postal_code"),
        landmark: str("recipient.landmark"),
      },
      delivery: {
        zone_id: zoneId,
        date,
        slot_id: slotId,
        instructions: str("delivery.instructions"),
      },
      gift_message: str("gift_message"),
      promo_code: promo?.valid ? promo.code : "",
      payment_method: paymentMethod,
      privacy_consent: data.get("privacy_consent") === "on",
      marketing_opt_in: data.get("marketing_opt_in") === "on",
    };
    const parsed = checkoutSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = flattenIssues(parsed.error);
      setErrors(fieldErrors);
      setFormError("Please check the highlighted fields.");
      document
        .getElementById(`${id}-${Object.keys(fieldErrors)[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await placeOrder(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        if (result.code === "CART_CHANGED" || result.code === "CART_EMPTY") {
          toast.error(result.error);
          router.push("/cart");
        }
        return;
      }
      if (result.next.kind === "redirect") {
        window.location.assign(result.next.url);
        return;
      }
      router.push(`/orders/${result.orderNumber}?t=${result.trackingToken}&placed=1`);
    });
  };

  const err = (key: string) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="text-xs text-destructive">
        {errors[key]}
      </p>
    ) : null;
  const a11y = (key: string) => ({
    id: `${id}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start"
    >
      <div className="flex flex-col gap-10">
        {/* Sender */}
        <fieldset className="flex flex-col gap-4">
          <legend className="font-serif text-2xl font-semibold">Your details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${id}-sender.name`}>Your name</Label>
              <Input
                name="sender.name"
                autoComplete="name"
                required
                className={field}
                {...a11y("sender.name")}
              />
              {err("sender.name")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-sender.email`}>Email</Label>
              <Input
                name="sender.email"
                type="email"
                autoComplete="email"
                required
                className={field}
                {...a11y("sender.email")}
              />
              {err("sender.email")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-sender.phone`}>Mobile number</Label>
              <Input
                name="sender.phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0917 123 4567"
                required
                className={field}
                {...a11y("sender.phone")}
              />
              {err("sender.phone")}
            </div>
          </div>
        </fieldset>

        {/* Recipient */}
        <fieldset className="flex flex-col gap-4">
          <legend className="font-serif text-2xl font-semibold">Deliver to</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-recipient.name`}>Recipient&apos;s name</Label>
              <Input
                name="recipient.name"
                required
                className={field}
                {...a11y("recipient.name")}
              />
              {err("recipient.name")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-recipient.phone`}>Recipient&apos;s mobile</Label>
              <Input
                name="recipient.phone"
                type="tel"
                inputMode="tel"
                placeholder="0918 123 4567"
                required
                className={field}
                {...a11y("recipient.phone")}
              />
              {err("recipient.phone")}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${id}-delivery.zone_id`}>Delivery zone</Label>
              <select
                id={`${id}-delivery.zone_id`}
                name="delivery.zone_id"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className={selectClass}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} · {formatCentavos(z.feeCentavos)}
                    {z.freeDeliveryThresholdCentavos
                      ? ` (free over ${formatCentavos(z.freeDeliveryThresholdCentavos)})`
                      : ""}
                  </option>
                ))}
              </select>
              {err("delivery.zone_id")}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${id}-recipient.address_line1`}>Street address</Label>
              <Input
                name="recipient.address_line1"
                autoComplete="shipping address-line1"
                placeholder="House no., street, building, unit"
                required
                className={field}
                {...a11y("recipient.address_line1")}
              />
              {err("recipient.address_line1")}
            </div>
            <div className="relative flex flex-col gap-1.5">
              <Label htmlFor={`${id}-recipient.barangay`}>Barangay</Label>
              <Input
                name="recipient.barangay"
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                list={`${id}-barangays`}
                autoComplete="off"
                required
                className={field}
                {...a11y("recipient.barangay")}
              />
              <datalist id={`${id}-barangays`}>
                {barangaySuggestions.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
              {err("recipient.barangay")}
              {zone ? (
                <p className="text-xs text-muted-foreground">
                  In {zone.city}. Start typing to see covered barangays.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-recipient.postal_code`}>
                Postal code (optional)
              </Label>
              <Input
                name="recipient.postal_code"
                inputMode="numeric"
                maxLength={4}
                className={field}
                {...a11y("recipient.postal_code")}
              />
              {err("recipient.postal_code")}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${id}-recipient.landmark`}>Landmark (optional)</Label>
              <Input
                name="recipient.landmark"
                placeholder="Beside the bakery, blue gate…"
                className={field}
                {...a11y("recipient.landmark")}
              />
            </div>
          </div>
        </fieldset>

        {/* Schedule */}
        <fieldset className="flex flex-col gap-4">
          <legend className="font-serif text-2xl font-semibold">When</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-delivery.date`}>Delivery date</Label>
              <Input
                id={`${id}-delivery.date`}
                name="delivery.date"
                type="date"
                value={date}
                min={todayManila()}
                max={addDays(todayManila(), 60)}
                onChange={(e) => setDate(e.target.value)}
                required
                className={field}
                aria-invalid={errors["delivery.date"] ? true : undefined}
              />
              {err("delivery.date")}
              {options && options.ok && !options.date_ok ? (
                <p className="text-xs text-destructive">{options.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-delivery.slot_id`}>Time slot</Label>
              <select
                id={`${id}-delivery.slot_id`}
                name="delivery.slot_id"
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className={selectClass}
                disabled={loadingSlots || !options?.slots?.length}
                aria-invalid={errors["delivery.slot_id"] ? true : undefined}
              >
                {loadingSlots ? <option value="">Loading slots…</option> : null}
                {!loadingSlots && !options?.slots?.length ? (
                  <option value="">No slots on this day</option>
                ) : null}
                {options?.slots?.map((s) => (
                  <option key={s.slot_id} value={s.slot_id} disabled={!s.available}>
                    {s.label}
                    {!s.available
                      ? s.remaining === 0
                        ? " · Full"
                        : " · Not available"
                      : s.remaining <= 3
                        ? ` · ${s.remaining} left`
                        : ""}
                  </option>
                ))}
              </select>
              {err("delivery.slot_id")}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${id}-delivery.instructions`}>
                Delivery instructions (optional)
              </Label>
              <Textarea
                name="delivery.instructions"
                rows={2}
                maxLength={500}
                placeholder="Leave with the guard, call on arrival…"
                className="bg-card"
                {...a11y("delivery.instructions")}
              />
              {err("delivery.instructions")}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${id}-gift_message`}>Gift message (optional)</Label>
              <Textarea
                name="gift_message"
                rows={3}
                maxLength={300}
                placeholder="We write this by hand on a Floriana card."
                className="bg-card"
                {...a11y("gift_message")}
              />
              {err("gift_message")}
            </div>
          </div>
        </fieldset>

        {/* Payment */}
        <fieldset className="flex flex-col gap-4">
          <legend className="font-serif text-2xl font-semibold">Payment</legend>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Payment method"
          >
            {paymentMethods.paymongo ? (
              <label
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-4",
                  paymentMethod === "paymongo"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card",
                )}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="paymongo"
                  checked={paymentMethod === "paymongo"}
                  onChange={() => setPaymentMethod("paymongo")}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">Pay online</span>
                  <span className="block text-xs text-muted-foreground">
                    GCash, Maya, cards or GrabPay on a secure PayMongo page.
                  </span>
                </span>
              </label>
            ) : null}
            {paymentMethods.bank_transfer ? (
              <label
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-4",
                  paymentMethod === "bank_transfer"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card",
                )}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="bank_transfer"
                  checked={paymentMethod === "bank_transfer"}
                  onChange={() => setPaymentMethod("bank_transfer")}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">
                    Bank transfer / GCash transfer
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    We hold your flowers for 24 hours while you transfer and upload the
                    receipt.
                  </span>
                </span>
              </label>
            ) : null}
          </div>
          {err("payment_method")}

          <div className="flex flex-col gap-2 pt-2">
            <label className="flex items-start gap-3 text-sm">
              <input
                id={`${id}-privacy_consent`}
                type="checkbox"
                name="privacy_consent"
                className="mt-1"
              />
              <span>
                I agree to the{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  privacy notice
                </a>{" "}
                and to Floriana Flowers sharing the recipient&apos;s details with the
                rider.
              </span>
            </label>
            {err("privacy_consent")}
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input type="checkbox" name="marketing_opt_in" className="mt-1" />
              <span>Email me about seasonal collections (optional).</span>
            </label>
          </div>
        </fieldset>
      </div>

      {/* Summary */}
      <aside
        className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 lg:sticky lg:top-24"
        aria-label="Order summary"
      >
        <h2 className="font-serif text-xl font-semibold">Order summary</h2>
        <ul className="divide-y text-sm">
          {cart.items.map((line) => (
            <li key={line.id} className="flex justify-between gap-3 py-2">
              <span>
                {line.quantity} × {line.product_name}{" "}
                <span className="text-muted-foreground">· {line.variant_name}</span>
                {line.add_ons.map((a) => (
                  <span key={a.add_on_id} className="block text-xs text-muted-foreground">
                    + {a.name}
                    {a.quantity > 1 ? ` × ${a.quantity}` : ""}
                  </span>
                ))}
              </span>
              <span className="tabular-nums">
                {formatCentavos(line.line_total_centavos + line.add_ons_total_centavos)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-promo_code`}>Promo code</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-promo_code`}
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="LOLA10"
              className="h-9 bg-background"
              aria-invalid={errors["promo_code"] ? true : undefined}
              aria-describedby={
                errors["promo_code"] ? `${id}-promo_code-error` : undefined
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={applyPromo}
              disabled={checkingPromo || !promoInput.trim()}
            >
              {checkingPromo ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <TagIcon data-icon="inline-start" />
              )}
              Apply
            </Button>
          </div>
          {err("promo_code")}
          {promo?.valid ? (
            <p className="text-xs text-success">
              {promo.code} applied{promo.description ? ` · ${promo.description}` : ""}.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setPromo(null);
                  setPromoInput("");
                }}
              >
                Remove
              </button>
            </p>
          ) : null}
        </div>

        <dl className="flex flex-col gap-1.5 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Items</dt>
            <dd className="tabular-nums">{formatCentavos(cart.subtotal_centavos)}</dd>
          </div>
          {cart.add_ons_centavos > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Add-ons</dt>
              <dd className="tabular-nums">{formatCentavos(cart.add_ons_centavos)}</dd>
            </div>
          ) : null}
          {discount > 0 ? (
            <div className="flex justify-between text-success">
              <dt>Promo</dt>
              <dd className="tabular-nums">−{formatCentavos(discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Delivery{zone ? ` · ${zone.name}` : ""}
            </dt>
            <dd className="tabular-nums">{fee === 0 ? "Free" : formatCentavos(fee)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="checkout-total">
              {formatCentavos(total)}
            </dd>
          </div>
        </dl>
        {belowMin && zone ? (
          <p className="text-xs text-destructive">
            Orders to {zone.name} need a minimum of{" "}
            {formatCentavos(zone.minOrderCentavos)}.
          </p>
        ) : null}

        {formError ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full text-base"
          disabled={pending || belowMin || !slotId}
        >
          {pending ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : (
            <LockIcon data-icon="inline-start" />
          )}
          {paymentMethod === "paymongo"
            ? `Pay ${formatCentavos(total)}`
            : `Place order · ${formatCentavos(total)}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Stock and delivery slot are confirmed when you place the order.
        </p>
      </aside>
    </form>
  );
}
