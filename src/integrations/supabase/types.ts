export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          benefit_expiry_days: number
          id: boolean
          loyalty_enabled: boolean
          referral_enabled: boolean
          updated_at: string
        }
        Insert: {
          benefit_expiry_days?: number
          id?: boolean
          loyalty_enabled?: boolean
          referral_enabled?: boolean
          updated_at?: string
        }
        Update: {
          benefit_expiry_days?: number
          id?: boolean
          loyalty_enabled?: boolean
          referral_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          benefit_type: string
          client_id: string
          completed_at: string | null
          created_at: string
          day: string
          discount_applied: boolean
          discount_percent: number
          google_event_id: string | null
          id: string
          notes: string | null
          payment_method: string | null
          price_cents: number
          reminder_sent_at: string | null
          service_id: string
          start_time: string
          status: string
        }
        Insert: {
          benefit_type?: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          day: string
          discount_applied?: boolean
          discount_percent?: number
          google_event_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          price_cents?: number
          reminder_sent_at?: string | null
          service_id: string
          start_time: string
          status?: string
        }
        Update: {
          benefit_type?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          day?: string
          discount_applied?: boolean
          discount_percent?: number
          google_event_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          price_cents?: number
          reminder_sent_at?: string | null
          service_id?: string
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          day: string
          id: string
          reason: string | null
        }
        Insert: {
          day: string
          id?: string
          reason?: string | null
        }
        Update: {
          day?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      catalogs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          title: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          title: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          drawn_at: string | null
          ends_on: string
          id: string
          image_url: string | null
          prize: string | null
          rules: string | null
          starts_on: string
          title: string
          winner_id: string | null
          winner_name: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          drawn_at?: string | null
          ends_on: string
          id?: string
          image_url?: string | null
          prize?: string | null
          rules?: string | null
          starts_on: string
          title: string
          winner_id?: string | null
          winner_name?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          drawn_at?: string | null
          ends_on?: string
          id?: string
          image_url?: string | null
          prize?: string | null
          rules?: string | null
          starts_on?: string
          title?: string
          winner_id?: string | null
          winner_name?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_cents: number
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_cents?: number
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_cents?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          login_id: string
          phone: string
          welcome_seen: boolean
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          login_id: string
          phone: string
          welcome_seen?: boolean
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          login_id?: string
          phone?: string
          welcome_seen?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          earned_at: string | null
          expires_at: string | null
          id: string
          notified: boolean
          referred_id: string
          referrer_id: string
          status: string
          used_appointment_id: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string
          earned_at?: string | null
          expires_at?: string | null
          id?: string
          notified?: boolean
          referred_id: string
          referrer_id: string
          status?: string
          used_appointment_id?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string
          earned_at?: string | null
          expires_at?: string | null
          id?: string
          notified?: boolean
          referred_id?: string
          referrer_id?: string
          status?: string
          used_appointment_id?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_used_appointment_id_fkey"
            columns: ["used_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_breaks: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          label: string | null
          start_time: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          id?: string
          label?: string | null
          start_time: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          label?: string | null
          start_time?: string
          weekday?: number
        }
        Relationships: []
      }
      schedule_slots: {
        Row: {
          active: boolean
          id: string
          start_time: string
          weekday: number
        }
        Insert: {
          active?: boolean
          id?: string
          start_time: string
          weekday: number
        }
        Update: {
          active?: boolean
          id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          duration_minutes: number
          id: string
          image_url: string | null
          loyalty_eligible: boolean
          name: string
          price_cents: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          duration_minutes: number
          id?: string
          image_url?: string | null
          loyalty_eligible?: boolean
          name: string
          price_cents: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          duration_minutes?: number
          id?: string
          image_url?: string | null
          loyalty_eligible?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
        }
        Relationships: []
      }
      store_orders: {
        Row: {
          amount_cents: number
          client_name: string
          client_phone: string
          created_at: string
          delivery_date: string | null
          id: string
          installments: number
          item_name: string
          notes: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          client_name: string
          client_phone?: string
          created_at?: string
          delivery_date?: string | null
          id?: string
          installments?: number
          item_name: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          client_name?: string
          client_phone?: string
          created_at?: string
          delivery_date?: string | null
          id?: string
          installments?: number
          item_name?: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          consumed: boolean
          created_at: string
          expires_at: string
          id: string
          phone: string
          purpose: string
        }
        Insert: {
          code: string
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          purpose?: string
        }
        Update: {
          code?: string
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client"],
    },
  },
} as const
