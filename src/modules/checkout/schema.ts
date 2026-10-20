import { z } from "zod";

/** +639XXXXXXXXX. Accepts common local forms and normalises them. */
export const phMobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-().]/g, ""))
  .transform((v) =>
    v.startsWith("09") ? `+63${v.slice(1)}` : v.startsWith("639") ? `+${v}` : v,
  )
  .pipe(
    z
      .string()
      .regex(
        /^\+639\d{9}$/,
        "Enter a valid Philippine mobile number, e.g. 0917 123 4567.",
      ),
  );

/** Optional free-text field: null/undefined/"" all mean "not provided". */
const optionalText = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((v) => v ?? "");

export const checkoutSchema = z.object({
  sender: z.object({
    name: z.string().trim().min(2, "Enter your name.").max(160),
    email: z.email({ message: "Enter a valid email address." }).max(254),
    phone: phMobileSchema,
  }),
  recipient: z.object({
    name: z.string().trim().min(2, "Enter the recipient's name.").max(160),
    phone: phMobileSchema,
    address_line1: z.string().trim().min(5, "Enter the street address.").max(200),
    address_line2: optionalText(200),
    barangay: z.string().trim().min(2, "Enter the barangay.").max(120),
    postal_code: optionalText(4).pipe(
      z.union([z.literal(""), z.string().regex(/^\d{4}$/, "Postal code is 4 digits.")]),
    ),
    landmark: optionalText(200),
  }),
  delivery: z.object({
    zone_id: z.uuid({ message: "Choose a delivery zone." }),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a delivery date."),
    slot_id: z.uuid({ message: "Choose a delivery time slot." }),
    instructions: optionalText(500, "Keep instructions under 500 characters."),
  }),
  gift_message: optionalText(300, "Keep the gift message under 300 characters."),
  promo_code: optionalText(40),
  payment_method: z.enum(["paymongo", "bank_transfer"], {
    message: "Choose a payment method.",
  }),
  privacy_consent: z.literal(true, { message: "Please agree to the privacy notice." }),
  marketing_opt_in: z.boolean().default(false),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutValues = z.output<typeof checkoutSchema>;

/** Flattens Zod issues into `path.to.field → message` for the form. */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
