export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      add_ons: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          name: string;
          price_centavos: number;
          sku: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name: string;
          price_centavos: number;
          sku: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name?: string;
          price_centavos?: number;
          sku?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["staff_role"] | null;
          after: Json | null;
          before: Json | null;
          changed_columns: string[] | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["staff_role"] | null;
          after?: Json | null;
          before?: Json | null;
          changed_columns?: string[] | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["staff_role"] | null;
          after?: Json | null;
          before?: Json | null;
          changed_columns?: string[] | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
        };
        Relationships: [];
      };
      bouquet_recipes: {
        Row: {
          assembly_minutes: number | null;
          created_at: string;
          id: string;
          instructions: string | null;
          name: string;
          updated_at: string;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          assembly_minutes?: number | null;
          created_at?: string;
          id?: string;
          instructions?: string | null;
          name: string;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          assembly_minutes?: number | null;
          created_at?: string;
          id?: string;
          instructions?: string | null;
          name?: string;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bouquet_recipes_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: true;
            referencedRelation: "catalog_products";
            referencedColumns: ["default_variant_id"];
          },
          {
            foreignKeyName: "bouquet_recipes_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: true;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      business_settings: {
        Row: {
          address: string | null;
          bank_transfer_enabled: boolean;
          bank_transfer_hold_hours: number;
          bank_transfer_instructions: string | null;
          contact_email: string;
          contact_phone: string;
          created_at: string;
          currency: string;
          extras: NonNullable<Json>;
          id: number;
          low_stock_alert_email: string | null;
          notifications_from_email: string;
          online_payments_enabled: boolean;
          reservation_ttl_minutes: number;
          same_day_cutoff: string;
          shop_name: string;
          sms_enabled: boolean;
          social: NonNullable<Json>;
          tagline: string;
          timezone: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          bank_transfer_enabled?: boolean;
          bank_transfer_hold_hours?: number;
          bank_transfer_instructions?: string | null;
          contact_email: string;
          contact_phone: string;
          created_at?: string;
          currency?: string;
          extras?: NonNullable<Json>;
          id?: number;
          low_stock_alert_email?: string | null;
          notifications_from_email?: string;
          online_payments_enabled?: boolean;
          reservation_ttl_minutes?: number;
          same_day_cutoff?: string;
          shop_name?: string;
          sms_enabled?: boolean;
          social?: NonNullable<Json>;
          tagline?: string;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address?: string | null;
          bank_transfer_enabled?: boolean;
          bank_transfer_hold_hours?: number;
          bank_transfer_instructions?: string | null;
          contact_email?: string;
          contact_phone?: string;
          created_at?: string;
          currency?: string;
          extras?: NonNullable<Json>;
          id?: number;
          low_stock_alert_email?: string | null;
          notifications_from_email?: string;
          online_payments_enabled?: boolean;
          reservation_ttl_minutes?: number;
          same_day_cutoff?: string;
          shop_name?: string;
          sms_enabled?: boolean;
          social?: NonNullable<Json>;
          tagline?: string;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      cart_item_add_ons: {
        Row: {
          add_on_id: string;
          cart_item_id: string;
          quantity: number;
        };
        ComputedFields: never;
        Insert: {
          add_on_id: string;
          cart_item_id: string;
          quantity: number;
        };
        Update: {
          add_on_id?: string;
          cart_item_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cart_item_add_ons_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "add_ons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_item_add_ons_cart_item_id_fkey";
            columns: ["cart_item_id"];
            isOneToOne: false;
            referencedRelation: "cart_items";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          id: string;
          quantity: number;
          unit_price_centavos_at_add: number;
          updated_at: string;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          cart_id: string;
          created_at?: string;
          id?: string;
          quantity: number;
          unit_price_centavos_at_add: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          id?: string;
          quantity?: number;
          unit_price_centavos_at_add?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["default_variant_id"];
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          converted_order_id: string | null;
          created_at: string;
          currency: string;
          customer_id: string | null;
          expires_at: string;
          id: string;
          status: Database["public"]["Enums"]["cart_status"];
          token_hash: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          converted_order_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          expires_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["cart_status"];
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          converted_order_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          expires_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["cart_status"];
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carts_converted_order_fk";
            columns: ["converted_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          name: string;
          position: number;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          tagline: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name: string;
          position?: number;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          tagline?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name?: string;
          position?: number;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          tagline?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          marketing_opt_in: boolean;
          notes: string | null;
          phone: string | null;
          privacy_consent_at: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id?: string;
          marketing_opt_in?: boolean;
          notes?: string | null;
          phone?: string | null;
          privacy_consent_at: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          marketing_opt_in?: boolean;
          notes?: string | null;
          phone?: string | null;
          privacy_consent_at?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      delivery_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          event_type: string;
          exception: Database["public"]["Enums"]["delivery_exception"] | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          note: string | null;
          order_id: string;
          proof_photo_path: string | null;
          received_by: string | null;
          rider_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          event_type: string;
          exception?: Database["public"]["Enums"]["delivery_exception"] | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          note?: string | null;
          order_id: string;
          proof_photo_path?: string | null;
          received_by?: string | null;
          rider_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          event_type?: string;
          exception?: Database["public"]["Enums"]["delivery_exception"] | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          note?: string | null;
          order_id?: string;
          proof_photo_path?: string | null;
          received_by?: string | null;
          rider_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_events_rider_id_fkey";
            columns: ["rider_id"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      delivery_slot_allocations: {
        Row: {
          booked: number;
          capacity: number;
          created_at: string;
          delivery_date: string;
          id: string;
          is_blocked: boolean;
          slot_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booked?: number;
          capacity: number;
          created_at?: string;
          delivery_date: string;
          id?: string;
          is_blocked?: boolean;
          slot_id: string;
          updated_at?: string;
        };
        Update: {
          booked?: number;
          capacity?: number;
          created_at?: string;
          delivery_date?: string;
          id?: string;
          is_blocked?: boolean;
          slot_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_slot_allocations_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "delivery_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_slots: {
        Row: {
          created_at: string;
          days_of_week: number[];
          default_capacity: number;
          ends_at: string;
          id: string;
          is_active: boolean;
          label: string;
          position: number;
          starts_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          days_of_week?: number[];
          default_capacity: number;
          ends_at: string;
          id?: string;
          is_active?: boolean;
          label: string;
          position?: number;
          starts_at: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          days_of_week?: number[];
          default_capacity?: number;
          ends_at?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          position?: number;
          starts_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      delivery_zones: {
        Row: {
          barangays: string[];
          city: string;
          created_at: string;
          fee_centavos: number;
          free_delivery_threshold_centavos: number | null;
          id: string;
          is_active: boolean;
          lead_time_hours: number;
          min_order_centavos: number;
          name: string;
          position: number;
          province: string;
          same_day_cutoff: string | null;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          barangays?: string[];
          city: string;
          created_at?: string;
          fee_centavos: number;
          free_delivery_threshold_centavos?: number | null;
          id?: string;
          is_active?: boolean;
          lead_time_hours?: number;
          min_order_centavos?: number;
          name: string;
          position?: number;
          province?: string;
          same_day_cutoff?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          barangays?: string[];
          city?: string;
          created_at?: string;
          fee_centavos?: number;
          free_delivery_threshold_centavos?: number | null;
          id?: string;
          is_active?: boolean;
          lead_time_hours?: number;
          min_order_centavos?: number;
          name?: string;
          position?: number;
          province?: string;
          same_day_cutoff?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          category: string;
          created_at: string;
          default_shelf_life_days: number | null;
          default_supplier_id: string | null;
          id: string;
          is_active: boolean;
          is_perishable: boolean;
          low_stock_threshold: number;
          name: string;
          sku: string;
          unit: Database["public"]["Enums"]["material_unit"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string;
          created_at?: string;
          default_shelf_life_days?: number | null;
          default_supplier_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_perishable?: boolean;
          low_stock_threshold?: number;
          name: string;
          sku: string;
          unit?: Database["public"]["Enums"]["material_unit"];
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          default_shelf_life_days?: number | null;
          default_supplier_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_perishable?: boolean;
          low_stock_threshold?: number;
          name?: string;
          sku?: string;
          unit?: Database["public"]["Enums"]["material_unit"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "materials_default_supplier_id_fkey";
            columns: ["default_supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          attempts: number;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          customer_id: string | null;
          dedupe_key: string | null;
          error: string | null;
          id: string;
          last_error: string | null;
          next_attempt_at: string;
          order_id: string | null;
          payload: NonNullable<Json>;
          provider: string | null;
          provider_message_id: string | null;
          recipient: string;
          scheduled_for: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_status"];
          subject: string | null;
          template: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          customer_id?: string | null;
          dedupe_key?: string | null;
          error?: string | null;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          order_id?: string | null;
          payload?: NonNullable<Json>;
          provider?: string | null;
          provider_message_id?: string | null;
          recipient: string;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          subject?: string | null;
          template: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          customer_id?: string | null;
          dedupe_key?: string | null;
          error?: string | null;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          order_id?: string | null;
          payload?: NonNullable<Json>;
          provider?: string | null;
          provider_message_id?: string | null;
          recipient?: string;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          subject?: string | null;
          template?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      occasions: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          name: string;
          position: number;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name: string;
          position?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name?: string;
          position?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_access_tokens: {
        Row: {
          created_at: string;
          order_id: string;
          token: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          order_id: string;
          token: string;
        };
        Update: {
          created_at?: string;
          order_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_access_tokens_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_item_add_ons: {
        Row: {
          add_on_id: string | null;
          id: string;
          line_total_centavos: number;
          name: string;
          order_item_id: string;
          quantity: number;
          sku: string;
          unit_price_centavos: number;
        };
        ComputedFields: never;
        Insert: {
          add_on_id?: string | null;
          id?: string;
          line_total_centavos: number;
          name: string;
          order_item_id: string;
          quantity: number;
          sku: string;
          unit_price_centavos: number;
        };
        Update: {
          add_on_id?: string | null;
          id?: string;
          line_total_centavos?: number;
          name?: string;
          order_item_id?: string;
          quantity?: number;
          sku?: string;
          unit_price_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_item_add_ons_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "add_ons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_add_ons_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          image_path: string | null;
          line_total_centavos: number;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          sku: string;
          unit_price_centavos: number;
          variant_id: string | null;
          variant_name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          image_path?: string | null;
          line_total_centavos: number;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          sku: string;
          unit_price_centavos: number;
          variant_id?: string | null;
          variant_name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          image_path?: string | null;
          line_total_centavos?: number;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          sku?: string;
          unit_price_centavos?: number;
          variant_id?: string | null;
          variant_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["default_variant_id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_recipients: {
        Row: {
          address_line1: string;
          address_line2: string | null;
          barangay: string;
          city: string;
          created_at: string;
          full_name: string;
          landmark: string | null;
          latitude: number | null;
          longitude: number | null;
          order_id: string;
          phone: string;
          postal_code: string | null;
          province: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_line1: string;
          address_line2?: string | null;
          barangay: string;
          city: string;
          created_at?: string;
          full_name: string;
          landmark?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          order_id: string;
          phone: string;
          postal_code?: string | null;
          province?: string;
          updated_at?: string;
        };
        Update: {
          address_line1?: string;
          address_line2?: string | null;
          barangay?: string;
          city?: string;
          created_at?: string;
          full_name?: string;
          landmark?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          order_id?: string;
          phone?: string;
          postal_code?: string | null;
          province?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_recipients_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: string | null;
          id: string;
          kind: Database["public"]["Enums"]["status_kind"];
          note: string | null;
          order_id: string;
          to_status: string;
        };
        ComputedFields: never;
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["status_kind"];
          note?: string | null;
          order_id: string;
          to_status: string;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["status_kind"];
          note?: string | null;
          order_id?: string;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_substitutions: {
        Row: {
          created_at: string;
          from_material_id: string;
          id: string;
          order_id: string;
          quantity: number;
          reason: string;
          requested_by: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["substitution_status"];
          to_material_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          from_material_id: string;
          id?: string;
          order_id: string;
          quantity: number;
          reason: string;
          requested_by?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["substitution_status"];
          to_material_id: string;
        };
        Update: {
          created_at?: string;
          from_material_id?: string;
          id?: string;
          order_id?: string;
          quantity?: number;
          reason?: string;
          requested_by?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["substitution_status"];
          to_material_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_substitutions_from_material_id_fkey";
            columns: ["from_material_id"];
            isOneToOne: false;
            referencedRelation: "material_stock_levels";
            referencedColumns: ["material_id"];
          },
          {
            foreignKeyName: "order_substitutions_from_material_id_fkey";
            columns: ["from_material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_substitutions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_substitutions_to_material_id_fkey";
            columns: ["to_material_id"];
            isOneToOne: false;
            referencedRelation: "material_stock_levels";
            referencedColumns: ["material_id"];
          },
          {
            foreignKeyName: "order_substitutions_to_material_id_fkey";
            columns: ["to_material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          add_ons_centavos: number;
          arrangement_photo_path: string | null;
          assigned_rider_id: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cart_id: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          currency: string;
          customer_email: string;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          delivered_at: string | null;
          delivery_attempts: number;
          delivery_date: string | null;
          delivery_failed_at: string | null;
          delivery_fee_centavos: number;
          delivery_instructions: string | null;
          delivery_slot_allocation_id: string | null;
          delivery_slot_snapshot: Json | null;
          delivery_status: Database["public"]["Enums"]["delivery_status"];
          delivery_zone_id: string | null;
          delivery_zone_snapshot: Json | null;
          discount_centavos: number;
          dispatched_at: string | null;
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"];
          gift_message: string | null;
          id: string;
          idempotency_key: string;
          internal_notes: string | null;
          metadata: NonNullable<Json>;
          order_number: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          placed_at: string;
          preparation_started_at: string | null;
          prepared_by: string | null;
          promo_code_id: string | null;
          promo_code_snapshot: string | null;
          ready_at: string | null;
          reservation_expires_at: string | null;
          rider_assigned_at: string | null;
          rider_assigned_by: string | null;
          source: string;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_centavos: number;
          total_centavos: number;
          tracking_token_hash: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          add_ons_centavos?: number;
          arrangement_photo_path?: string | null;
          assigned_rider_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cart_id?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_email: string;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          delivered_at?: string | null;
          delivery_attempts?: number;
          delivery_date?: string | null;
          delivery_failed_at?: string | null;
          delivery_fee_centavos?: number;
          delivery_instructions?: string | null;
          delivery_slot_allocation_id?: string | null;
          delivery_slot_snapshot?: Json | null;
          delivery_status?: Database["public"]["Enums"]["delivery_status"];
          delivery_zone_id?: string | null;
          delivery_zone_snapshot?: Json | null;
          discount_centavos?: number;
          dispatched_at?: string | null;
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"];
          gift_message?: string | null;
          id?: string;
          idempotency_key: string;
          internal_notes?: string | null;
          metadata?: NonNullable<Json>;
          order_number?: string;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          placed_at?: string;
          preparation_started_at?: string | null;
          prepared_by?: string | null;
          promo_code_id?: string | null;
          promo_code_snapshot?: string | null;
          ready_at?: string | null;
          reservation_expires_at?: string | null;
          rider_assigned_at?: string | null;
          rider_assigned_by?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_centavos: number;
          total_centavos: number;
          tracking_token_hash: string;
          updated_at?: string;
        };
        Update: {
          add_ons_centavos?: number;
          arrangement_photo_path?: string | null;
          assigned_rider_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cart_id?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_email?: string;
          customer_id?: string;
          customer_name?: string;
          customer_phone?: string;
          delivered_at?: string | null;
          delivery_attempts?: number;
          delivery_date?: string | null;
          delivery_failed_at?: string | null;
          delivery_fee_centavos?: number;
          delivery_instructions?: string | null;
          delivery_slot_allocation_id?: string | null;
          delivery_slot_snapshot?: Json | null;
          delivery_status?: Database["public"]["Enums"]["delivery_status"];
          delivery_zone_id?: string | null;
          delivery_zone_snapshot?: Json | null;
          discount_centavos?: number;
          dispatched_at?: string | null;
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"];
          gift_message?: string | null;
          id?: string;
          idempotency_key?: string;
          internal_notes?: string | null;
          metadata?: NonNullable<Json>;
          order_number?: string;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          placed_at?: string;
          preparation_started_at?: string | null;
          prepared_by?: string | null;
          promo_code_id?: string | null;
          promo_code_snapshot?: string | null;
          ready_at?: string | null;
          reservation_expires_at?: string | null;
          rider_assigned_at?: string | null;
          rider_assigned_by?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_centavos?: number;
          total_centavos?: number;
          tracking_token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_assigned_rider_id_fkey";
            columns: ["assigned_rider_id"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "orders_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_delivery_slot_allocation_id_fkey";
            columns: ["delivery_slot_allocation_id"];
            isOneToOne: false;
            referencedRelation: "delivery_slot_allocations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey";
            columns: ["delivery_zone_id"];
            isOneToOne: false;
            referencedRelation: "delivery_zones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_prepared_by_fkey";
            columns: ["prepared_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "orders_promo_code_id_fkey";
            columns: ["promo_code_id"];
            isOneToOne: false;
            referencedRelation: "promo_codes";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          event_type: string;
          id: string;
          payload: NonNullable<Json>;
          payment_id: string | null;
          processed_at: string | null;
          processing_error: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_event_id: string;
          received_at: string;
          signature_verified: boolean;
        };
        ComputedFields: never;
        Insert: {
          event_type: string;
          id?: string;
          payload: NonNullable<Json>;
          payment_id?: string | null;
          processed_at?: string | null;
          processing_error?: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_event_id: string;
          received_at?: string;
          signature_verified?: boolean;
        };
        Update: {
          event_type?: string;
          id?: string;
          payload?: NonNullable<Json>;
          payment_id?: string | null;
          processed_at?: string | null;
          processing_error?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_event_id?: string;
          received_at?: string;
          signature_verified?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_centavos: number;
          attempt: number;
          checkout_url: string | null;
          created_at: string;
          currency: string;
          expires_at: string | null;
          failure_code: string | null;
          failure_message: string | null;
          id: string;
          idempotency_key: string;
          method: Database["public"]["Enums"]["payment_method"] | null;
          order_id: string;
          paid_at: string | null;
          proof_storage_path: string | null;
          proof_uploaded_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_data: NonNullable<Json>;
          provider_payment_id: string | null;
          provider_reference: string | null;
          status: Database["public"]["Enums"]["payment_record_status"];
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_centavos: number;
          attempt?: number;
          checkout_url?: string | null;
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          idempotency_key: string;
          method?: Database["public"]["Enums"]["payment_method"] | null;
          order_id: string;
          paid_at?: string | null;
          proof_storage_path?: string | null;
          proof_uploaded_at?: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_data?: NonNullable<Json>;
          provider_payment_id?: string | null;
          provider_reference?: string | null;
          status?: Database["public"]["Enums"]["payment_record_status"];
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          amount_centavos?: number;
          attempt?: number;
          checkout_url?: string | null;
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          idempotency_key?: string;
          method?: Database["public"]["Enums"]["payment_method"] | null;
          order_id?: string;
          paid_at?: string | null;
          proof_storage_path?: string | null;
          proof_uploaded_at?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_data?: NonNullable<Json>;
          provider_payment_id?: string | null;
          provider_reference?: string | null;
          status?: Database["public"]["Enums"]["payment_record_status"];
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      product_add_ons: {
        Row: {
          add_on_id: string;
          max_quantity: number;
          position: number;
          product_id: string;
        };
        ComputedFields: never;
        Insert: {
          add_on_id: string;
          max_quantity?: number;
          position?: number;
          product_id: string;
        };
        Update: {
          add_on_id?: string;
          max_quantity?: number;
          position?: number;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_add_ons_add_on_id_fkey";
            columns: ["add_on_id"];
            isOneToOne: false;
            referencedRelation: "add_ons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_add_ons_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_add_ons_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string;
          created_at: string;
          height: number | null;
          id: string;
          position: number;
          product_id: string;
          storage_path: string;
          variant_id: string | null;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          alt_text: string;
          created_at?: string;
          height?: number | null;
          id?: string;
          position?: number;
          product_id: string;
          storage_path: string;
          variant_id?: string | null;
          width?: number | null;
        };
        Update: {
          alt_text?: string;
          created_at?: string;
          height?: number | null;
          id?: string;
          position?: number;
          product_id?: string;
          storage_path?: string;
          variant_id?: string | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_images_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["default_variant_id"];
          },
          {
            foreignKeyName: "product_images_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_occasions: {
        Row: {
          occasion_id: string;
          product_id: string;
        };
        ComputedFields: never;
        Insert: {
          occasion_id: string;
          product_id: string;
        };
        Update: {
          occasion_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_occasions_occasion_id_fkey";
            columns: ["occasion_id"];
            isOneToOne: false;
            referencedRelation: "occasions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_occasions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_occasions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_reviews: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          body: string;
          created_at: string;
          customer_id: string | null;
          id: string;
          is_approved: boolean;
          order_id: string | null;
          product_id: string;
          rating: number;
          reviewer_name: string;
          title: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          body: string;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          is_approved?: boolean;
          order_id?: string | null;
          product_id: string;
          rating: number;
          reviewer_name: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          body?: string;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          is_approved?: boolean;
          order_id?: string | null;
          product_id?: string;
          rating?: number;
          reviewer_name?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_tags: {
        Row: {
          product_id: string;
          tag_id: string;
        };
        ComputedFields: never;
        Insert: {
          product_id: string;
          tag_id: string;
        };
        Update: {
          product_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_tags_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          attributes: NonNullable<Json>;
          compare_at_price_centavos: number | null;
          created_at: string;
          id: string;
          inventory_mode: Database["public"]["Enums"]["inventory_mode"];
          is_active: boolean;
          is_default: boolean;
          name: string;
          position: number;
          price_centavos: number;
          product_id: string;
          sku: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attributes?: NonNullable<Json>;
          compare_at_price_centavos?: number | null;
          created_at?: string;
          id?: string;
          inventory_mode?: Database["public"]["Enums"]["inventory_mode"];
          is_active?: boolean;
          is_default?: boolean;
          name: string;
          position?: number;
          price_centavos: number;
          product_id: string;
          sku: string;
          updated_at?: string;
        };
        Update: {
          attributes?: NonNullable<Json>;
          compare_at_price_centavos?: number | null;
          created_at?: string;
          id?: string;
          inventory_mode?: Database["public"]["Enums"]["inventory_mode"];
          is_active?: boolean;
          is_default?: boolean;
          name?: string;
          position?: number;
          price_centavos?: number;
          product_id?: string;
          sku?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "catalog_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          attributes: NonNullable<Json>;
          care_instructions: string | null;
          collection_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_best_seller: boolean;
          is_featured: boolean;
          name: string;
          position: number;
          published_at: string | null;
          search_vector: unknown;
          seo_description: string | null;
          seo_title: string | null;
          short_description: string | null;
          slug: string;
          status: Database["public"]["Enums"]["product_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attributes?: NonNullable<Json>;
          care_instructions?: string | null;
          collection_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_best_seller?: boolean;
          is_featured?: boolean;
          name: string;
          position?: number;
          published_at?: string | null;
          search_vector?: never;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["product_status"];
          updated_at?: string;
        };
        Update: {
          attributes?: NonNullable<Json>;
          care_instructions?: string | null;
          collection_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_best_seller?: boolean;
          is_featured?: boolean;
          name?: string;
          position?: number;
          published_at?: string | null;
          search_vector?: never;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["product_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
        ];
      };
      promo_codes: {
        Row: {
          applies_to: string;
          code: string;
          created_at: string;
          description: string | null;
          eligible_collection_ids: string[];
          ends_at: string | null;
          first_order_only: boolean;
          id: string;
          is_active: boolean;
          max_discount_centavos: number | null;
          max_uses: number | null;
          min_subtotal_centavos: number;
          per_customer_limit: number | null;
          promo_type: Database["public"]["Enums"]["promo_type"];
          starts_at: string | null;
          updated_at: string;
          uses_count: number;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          applies_to?: string;
          code: string;
          created_at?: string;
          description?: string | null;
          eligible_collection_ids?: string[];
          ends_at?: string | null;
          first_order_only?: boolean;
          id?: string;
          is_active?: boolean;
          max_discount_centavos?: number | null;
          max_uses?: number | null;
          min_subtotal_centavos?: number;
          per_customer_limit?: number | null;
          promo_type: Database["public"]["Enums"]["promo_type"];
          starts_at?: string | null;
          updated_at?: string;
          uses_count?: number;
          value: number;
        };
        Update: {
          applies_to?: string;
          code?: string;
          created_at?: string;
          description?: string | null;
          eligible_collection_ids?: string[];
          ends_at?: string | null;
          first_order_only?: boolean;
          id?: string;
          is_active?: boolean;
          max_discount_centavos?: number | null;
          max_uses?: number | null;
          min_subtotal_centavos?: number;
          per_customer_limit?: number | null;
          promo_type?: Database["public"]["Enums"]["promo_type"];
          starts_at?: string | null;
          updated_at?: string;
          uses_count?: number;
          value?: number;
        };
        Relationships: [];
      };
      promo_redemptions: {
        Row: {
          created_at: string;
          customer_email: string;
          discount_centavos: number;
          id: string;
          order_id: string;
          promo_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          customer_email: string;
          discount_centavos: number;
          id?: string;
          order_id: string;
          promo_id: string;
        };
        Update: {
          created_at?: string;
          customer_email?: string;
          discount_centavos?: number;
          id?: string;
          order_id?: string;
          promo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promo_redemptions_promo_id_fkey";
            columns: ["promo_id"];
            isOneToOne: false;
            referencedRelation: "promo_codes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_items: {
        Row: {
          is_optional: boolean;
          material_id: string;
          quantity: number;
          recipe_id: string;
        };
        ComputedFields: never;
        Insert: {
          is_optional?: boolean;
          material_id: string;
          quantity: number;
          recipe_id: string;
        };
        Update: {
          is_optional?: boolean;
          material_id?: string;
          quantity?: number;
          recipe_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_items_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "material_stock_levels";
            referencedColumns: ["material_id"];
          },
          {
            foreignKeyName: "recipe_items_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "bouquet_recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      refunds: {
        Row: {
          amount_centavos: number;
          created_at: string;
          failure_message: string | null;
          id: string;
          idempotency_key: string;
          payment_id: string;
          processed_at: string | null;
          provider_refund_id: string | null;
          reason: string;
          requested_by: string | null;
          status: Database["public"]["Enums"]["refund_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_centavos: number;
          created_at?: string;
          failure_message?: string | null;
          id?: string;
          idempotency_key: string;
          payment_id: string;
          processed_at?: string | null;
          provider_refund_id?: string | null;
          reason: string;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["refund_status"];
          updated_at?: string;
        };
        Update: {
          amount_centavos?: number;
          created_at?: string;
          failure_message?: string | null;
          id?: string;
          idempotency_key?: string;
          payment_id?: string;
          processed_at?: string | null;
          provider_refund_id?: string | null;
          reason?: string;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["refund_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      site_content: {
        Row: {
          created_at: string;
          data: NonNullable<Json>;
          is_published: boolean;
          key: string;
          published_at: string | null;
          published_data: Json | null;
          schema_hint: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          data?: NonNullable<Json>;
          is_published?: boolean;
          key: string;
          published_at?: string | null;
          published_data?: Json | null;
          schema_hint?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          data?: NonNullable<Json>;
          is_published?: boolean;
          key?: string;
          published_at?: string | null;
          published_data?: Json | null;
          schema_hint?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      staff_profiles: {
        Row: {
          created_at: string;
          display_name: string;
          is_active: boolean;
          phone: string | null;
          role: Database["public"]["Enums"]["staff_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          is_active?: boolean;
          phone?: string | null;
          role: Database["public"]["Enums"]["staff_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          is_active?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["staff_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      stock_batches: {
        Row: {
          batch_code: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          material_id: string;
          notes: string | null;
          quantity_received: number;
          quantity_remaining: number;
          quantity_reserved: number;
          received_at: string;
          status: Database["public"]["Enums"]["stock_batch_status"];
          supplier_id: string | null;
          unit_cost_centavos: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          batch_code: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          material_id: string;
          notes?: string | null;
          quantity_received: number;
          quantity_remaining: number;
          quantity_reserved?: number;
          received_at?: string;
          status?: Database["public"]["Enums"]["stock_batch_status"];
          supplier_id?: string | null;
          unit_cost_centavos?: number;
          updated_at?: string;
        };
        Update: {
          batch_code?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          material_id?: string;
          notes?: string | null;
          quantity_received?: number;
          quantity_remaining?: number;
          quantity_reserved?: number;
          received_at?: string;
          status?: Database["public"]["Enums"]["stock_batch_status"];
          supplier_id?: string | null;
          unit_cost_centavos?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_batches_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "material_stock_levels";
            referencedColumns: ["material_id"];
          },
          {
            foreignKeyName: "stock_batches_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_batches_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          batch_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          material_id: string;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          quantity: number;
          reason: string | null;
          reference_id: string | null;
          reference_type: string | null;
          wastage_reason: string | null;
        };
        ComputedFields: never;
        Insert: {
          batch_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          material_id: string;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          quantity: number;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          wastage_reason?: string | null;
        };
        Update: {
          batch_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          material_id?: string;
          movement_type?: Database["public"]["Enums"]["stock_movement_type"];
          quantity?: number;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          wastage_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "inventory_reconciliation";
            referencedColumns: ["batch_id"];
          },
          {
            foreignKeyName: "stock_movements_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "stock_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "material_stock_levels";
            referencedColumns: ["material_id"];
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_reservations: {
        Row: {
          batch_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string;
          material_id: string;
          quantity: number;
          reference_id: string;
          reference_type: string;
          status: Database["public"]["Enums"]["stock_reservation_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          batch_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key: string;
          material_id: string;
          quantity: number;
          reference_id: string;
          reference_type: string;
          status?: Database["public"]["Enums"]["stock_reservation_status"];
          updated_at?: string;
        };
        Update: {
          batch_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string;
          material_id?: string;
          quantity?: number;
          reference_id?: string;
          reference_type?: string;
          status?: Database["public"]["Enums"]["stock_reservation_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_reservations_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "inventory_reconciliation";
            referencedColumns: ["batch_id"];
          },
          {
            foreignKeyName: "stock_reservations_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "stock_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_reservations_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "material_stock_levels";
            referencedColumns: ["material_id"];
          },
          {
            foreignKeyName: "stock_reservations_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          address: string | null;
          contact_name: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      catalog_products: {
        Row: {
          availability: string | null;
          collection_id: string | null;
          collection_name: string | null;
          collection_slug: string | null;
          compare_at_price_centavos: number | null;
          default_variant_id: string | null;
          id: string | null;
          image_alt: string | null;
          image_path: string | null;
          is_best_seller: boolean | null;
          is_featured: boolean | null;
          max_price_centavos: number | null;
          min_price_centavos: number | null;
          name: string | null;
          occasion_slugs: string[] | null;
          position: number | null;
          price_centavos: number | null;
          published_at: string | null;
          search_vector: unknown;
          short_description: string | null;
          slug: string | null;
          status: Database["public"]["Enums"]["product_status"] | null;
          tag_slugs: string[] | null;
          variant_count: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "products_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_reconciliation: {
        Row: {
          active_reservations: number | null;
          balanced: boolean | null;
          batch_code: string | null;
          batch_id: string | null;
          expected_remaining: number | null;
          journal_out_and_adjust: number | null;
          journal_received: number | null;
          material: string | null;
          quantity_received: number | null;
          quantity_remaining: number | null;
          quantity_reserved: number | null;
          sku: string | null;
          status: Database["public"]["Enums"]["stock_batch_status"] | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      material_stock_levels: {
        Row: {
          available: number | null;
          category: string | null;
          expiring_soon: number | null;
          is_active: boolean | null;
          is_low: boolean | null;
          is_perishable: boolean | null;
          low_stock_threshold: number | null;
          material_id: string | null;
          name: string | null;
          next_expiry: string | null;
          on_hand: number | null;
          reserved: number | null;
          sku: string | null;
          unit: Database["public"]["Enums"]["material_unit"] | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      adjust_stock: {
        Args: { p_batch_id: string; p_delta: number; p_reason: string };
        Returns: Json;
      };
      apply_substitution: {
        Args: {
          p_from_material_id: string;
          p_order_id: string;
          p_quantity: number;
          p_reason: string;
          p_to_material_id: string;
        };
        Returns: Json;
      };
      assign_rider: { Args: { p_order_id: string; p_rider_id?: string }; Returns: Json };
      attach_payment_proof: {
        Args: {
          p_order_number: string;
          p_reference?: string;
          p_storage_path: string;
          p_token: string;
        };
        Returns: Json;
      };
      authorize_delivery_retry: {
        Args: { p_note?: string; p_order_id: string };
        Returns: Json;
      };
      cancel_order: { Args: { p_order_id: string; p_reason: string }; Returns: Json };
      cart_add_item: {
        Args: {
          p_add_ons?: Json;
          p_quantity?: number;
          p_token: string;
          p_variant_id: string;
        };
        Returns: Json;
      };
      cart_get: { Args: { p_token: string }; Returns: Json };
      cart_remove_item: { Args: { p_item_id: string; p_token: string }; Returns: Json };
      cart_remove_unavailable: { Args: { p_token: string }; Returns: Json };
      cart_update_item: {
        Args: { p_item_id: string; p_quantity: number; p_token: string };
        Returns: Json;
      };
      claim_due_notifications: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          customer_id: string | null;
          dedupe_key: string | null;
          error: string | null;
          id: string;
          last_error: string | null;
          next_attempt_at: string;
          order_id: string | null;
          payload: NonNullable<Json>;
          provider: string | null;
          provider_message_id: string | null;
          recipient: string;
          scheduled_for: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_status"];
          subject: string | null;
          template: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_delivery: {
        Args: {
          p_latitude?: number;
          p_longitude?: number;
          p_note?: string;
          p_order_id: string;
          p_proof_photo_path: string;
          p_received_by?: string;
        };
        Returns: Json;
      };
      complete_preparation: {
        Args: {
          p_actual: Json;
          p_notes?: string;
          p_order_id: string;
          p_photo_path?: string;
        };
        Returns: Json;
      };
      consume_stock_reservations: {
        Args: { p_reference_id: string; p_reference_type: string };
        Returns: number;
      };
      create_payment_attempt: {
        Args: {
          p_expires_at?: string;
          p_idempotency_key: string;
          p_order_id: string;
          p_provider: Database["public"]["Enums"]["payment_provider"];
        };
        Returns: Json;
      };
      dashboard_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      dispatch_board: { Args: { p_date?: string }; Returns: Json };
      enqueue_low_stock_digest: { Args: Record<PropertyKey, never>; Returns: number };
      expire_stock_batches: { Args: Record<PropertyKey, never>; Returns: number };
      expire_stock_reservations: { Args: Record<PropertyKey, never>; Returns: number };
      expire_unpaid_orders: { Args: Record<PropertyKey, never>; Returns: number };
      fail_delivery: {
        Args: {
          p_exception: Database["public"]["Enums"]["delivery_exception"];
          p_note: string;
          p_order_id: string;
          p_photo_path?: string;
        };
        Returns: Json;
      };
      find_delivery_zone: {
        Args: { p_query: string };
        Returns: {
          city: string;
          fee_centavos: number;
          free_delivery_threshold_centavos: number;
          lead_time_hours: number;
          matched_barangay: string;
          same_day_cutoff: string;
          zone_id: string;
          zone_name: string;
        }[];
      };
      find_payment_by_provider_ref: {
        Args: {
          p_provider: Database["public"]["Enums"]["payment_provider"];
          p_provider_payment_id: string;
        };
        Returns: Json;
      };
      get_order_for_tracking: {
        Args: { p_order_number: string; p_token: string };
        Returns: Json;
      };
      list_delivery_options: {
        Args: { p_delivery_date: string; p_zone_id: string };
        Returns: Json;
      };
      mark_notification_result: {
        Args: {
          p_error?: string;
          p_id: string;
          p_max_attempts?: number;
          p_ok: boolean;
          p_provider?: string;
          p_provider_message_id?: string;
        };
        Returns: undefined;
      };
      mark_order_paid: {
        Args: {
          p_method?: Database["public"]["Enums"]["payment_method"];
          p_paid_at?: string;
          p_payment_id: string;
          p_provider_data?: Json;
          p_provider_payment_id?: string;
          p_verified_by?: string;
        };
        Returns: Json;
      };
      mark_payment_event_processed: {
        Args: { p_error?: string; p_event_id: string; p_payment_id?: string };
        Returns: undefined;
      };
      mark_payment_failed: {
        Args: {
          p_failure_code?: string;
          p_failure_message?: string;
          p_payment_id: string;
          p_provider_data?: Json;
        };
        Returns: Json;
      };
      material_available_quantity: { Args: { p_material_id: string }; Returns: number };
      place_order: {
        Args: { p_cart_token: string; p_idempotency_key: string; p_input: Json };
        Returns: Json;
      };
      preparation_details: { Args: { p_order_id: string }; Returns: Json };
      preparation_queue: { Args: { p_include_ready?: boolean }; Returns: Json };
      receive_stock: {
        Args: {
          p_batch_code?: string;
          p_expires_at?: string;
          p_material_id: string;
          p_notes?: string;
          p_quantity: number;
          p_received_at?: string;
          p_supplier_id?: string;
          p_unit_cost_centavos: number;
        };
        Returns: Json;
      };
      record_payment_event: {
        Args: {
          p_event_id: string;
          p_event_type: string;
          p_payload: Json;
          p_payment_id?: string;
          p_provider: Database["public"]["Enums"]["payment_provider"];
          p_signature_verified: boolean;
        };
        Returns: Json;
      };
      record_refund: {
        Args: {
          p_amount_centavos: number;
          p_idempotency_key: string;
          p_payment_id: string;
          p_provider_refund_id?: string;
          p_reason: string;
          p_status: Database["public"]["Enums"]["refund_status"];
        };
        Returns: Json;
      };
      record_wastage: {
        Args: {
          p_batch_id: string;
          p_note?: string;
          p_quantity: number;
          p_reason: string;
        };
        Returns: Json;
      };
      release_delivery_slot: { Args: { p_allocation_id: string }; Returns: undefined };
      release_stock_reservations: {
        Args: { p_reason?: string; p_reference_id: string; p_reference_type: string };
        Returns: number;
      };
      report_best_sellers: {
        Args: { p_from: string; p_limit?: number; p_to: string };
        Returns: {
          orders: number;
          product_name: string;
          revenue_centavos: number;
          sku: string;
          units: number;
          variant_name: string;
        }[];
      };
      report_orders_by_date: {
        Args: { p_from: string; p_to: string };
        Returns: {
          day: string;
          delivery_fees_centavos: number;
          discounts_centavos: number;
          gross_centavos: number;
          net_centavos: number;
          paid_orders: number;
          refunds_centavos: number;
        }[];
      };
      report_payment_methods: {
        Args: { p_from: string; p_to: string };
        Returns: {
          amount_centavos: number;
          method: string;
          payments: number;
          provider: string;
          refunded_centavos: number;
        }[];
      };
      report_product_margin: {
        Args: { p_from: string; p_to: string };
        Returns: {
          estimated_cost_centavos: number;
          estimated_margin_centavos: number;
          estimated_margin_pct: number;
          is_estimate: boolean;
          product_name: string;
          revenue_centavos: number;
          sku: string;
          units: number;
          variant_name: string;
        }[];
      };
      report_sales_by_collection: {
        Args: { p_from: string; p_to: string };
        Returns: {
          collection: string;
          orders: number;
          revenue_centavos: number;
          units: number;
        }[];
      };
      report_sales_summary: { Args: { p_from: string; p_to: string }; Returns: Json };
      report_wastage: {
        Args: { p_from: string; p_to: string };
        Returns: {
          estimated_cost_centavos: number;
          events: number;
          material: string;
          quantity: number;
          reason: string;
          sku: string;
          unit: string;
        }[];
      };
      reschedule_delivery: {
        Args: {
          p_delivery_date: string;
          p_note?: string;
          p_order_id: string;
          p_slot_id: string;
        };
        Returns: Json;
      };
      reserve_delivery_slot: {
        Args: { p_delivery_date: string; p_slot_id: string };
        Returns: string;
      };
      reserve_stock: {
        Args: {
          p_expires_at?: string;
          p_idempotency_key: string;
          p_lines: Json;
          p_reference_id: string;
          p_reference_type: string;
        };
        Returns: {
          batch_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string;
          material_id: string;
          quantity: number;
          reference_id: string;
          reference_type: string;
          status: Database["public"]["Enums"]["stock_reservation_status"];
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "stock_reservations";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      review_substitution: {
        Args: { p_approve: boolean; p_note?: string; p_substitution_id: string };
        Returns: Json;
      };
      rider_deliveries: { Args: { p_include_done?: boolean }; Returns: Json };
      set_slot_capacity: {
        Args: {
          p_blocked?: boolean;
          p_capacity: number;
          p_delivery_date: string;
          p_slot_id: string;
        };
        Returns: Json;
      };
      start_delivery: { Args: { p_order_id: string }; Returns: Json };
      start_preparation: { Args: { p_order_id: string }; Returns: Json };
      upcoming_material_requirements: {
        Args: { p_days?: number };
        Returns: {
          available: number;
          material_id: string;
          name: string;
          orders: number;
          required: number;
          reserved: number;
          shortfall: number;
          sku: string;
          unit: Database["public"]["Enums"]["material_unit"];
        }[];
      };
      update_payment_provider_ref: {
        Args: {
          p_checkout_url: string;
          p_payment_id: string;
          p_provider_data?: Json;
          p_provider_payment_id: string;
        };
        Returns: undefined;
      };
      validate_promo_code: {
        Args: {
          p_cart_token?: string;
          p_code: string;
          p_email?: string;
          p_goods_centavos: number;
        };
        Returns: Json;
      };
      variant_availability: { Args: { p_variant_id: string }; Returns: string };
      variant_available_quantity: { Args: { p_variant_id: string }; Returns: number };
      verify_bank_transfer: {
        Args: { p_approve: boolean; p_note?: string; p_payment_id: string };
        Returns: Json;
      };
    };
    Enums: {
      cart_status: "active" | "converted" | "abandoned" | "merged";
      delivery_exception:
        | "recipient_unavailable"
        | "wrong_address"
        | "refused"
        | "weather"
        | "vehicle"
        | "other";
      delivery_status:
        | "pending"
        | "scheduled"
        | "out_for_delivery"
        | "delivered"
        | "failed"
        | "cancelled";
      fulfillment_status:
        "unfulfilled" | "preparing" | "ready" | "fulfilled" | "cancelled";
      inventory_mode: "recipe" | "untracked";
      material_unit: "stem" | "bunch" | "piece" | "gram" | "millilitre" | "metre";
      notification_channel: "email" | "sms";
      notification_status: "queued" | "sent" | "failed" | "skipped";
      order_status: "pending" | "confirmed" | "completed" | "cancelled";
      payment_method:
        "card" | "gcash" | "maya" | "grab_pay" | "bank_transfer" | "cash" | "other";
      payment_provider: "paymongo" | "bank_transfer" | "manual";
      payment_record_status:
        | "pending"
        | "requires_action"
        | "paid"
        | "failed"
        | "cancelled"
        | "expired"
        | "refunded"
        | "partially_refunded";
      payment_status:
        "unpaid" | "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
      product_status: "draft" | "active" | "archived";
      promo_type: "percent" | "fixed";
      refund_status: "pending" | "succeeded" | "failed";
      staff_role: "owner" | "manager" | "florist" | "rider" | "support";
      status_kind: "order" | "payment" | "fulfillment" | "delivery";
      stock_batch_status: "active" | "depleted" | "expired" | "discarded";
      stock_movement_type:
        "receive" | "reserve" | "release" | "consume" | "adjust" | "discard" | "expire";
      stock_reservation_status: "active" | "consumed" | "released" | "expired";
      substitution_status: "applied" | "approved" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      cart_status: ["active", "converted", "abandoned", "merged"],
      delivery_exception: [
        "recipient_unavailable",
        "wrong_address",
        "refused",
        "weather",
        "vehicle",
        "other",
      ],
      delivery_status: [
        "pending",
        "scheduled",
        "out_for_delivery",
        "delivered",
        "failed",
        "cancelled",
      ],
      fulfillment_status: ["unfulfilled", "preparing", "ready", "fulfilled", "cancelled"],
      inventory_mode: ["recipe", "untracked"],
      material_unit: ["stem", "bunch", "piece", "gram", "millilitre", "metre"],
      notification_channel: ["email", "sms"],
      notification_status: ["queued", "sent", "failed", "skipped"],
      order_status: ["pending", "confirmed", "completed", "cancelled"],
      payment_method: [
        "card",
        "gcash",
        "maya",
        "grab_pay",
        "bank_transfer",
        "cash",
        "other",
      ],
      payment_provider: ["paymongo", "bank_transfer", "manual"],
      payment_record_status: [
        "pending",
        "requires_action",
        "paid",
        "failed",
        "cancelled",
        "expired",
        "refunded",
        "partially_refunded",
      ],
      payment_status: [
        "unpaid",
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      product_status: ["draft", "active", "archived"],
      promo_type: ["percent", "fixed"],
      refund_status: ["pending", "succeeded", "failed"],
      staff_role: ["owner", "manager", "florist", "rider", "support"],
      status_kind: ["order", "payment", "fulfillment", "delivery"],
      stock_batch_status: ["active", "depleted", "expired", "discarded"],
      stock_movement_type: [
        "receive",
        "reserve",
        "release",
        "consume",
        "adjust",
        "discard",
        "expire",
      ],
      stock_reservation_status: ["active", "consumed", "released", "expired"],
      substitution_status: ["applied", "approved", "rejected"],
    },
  },
} as const;
