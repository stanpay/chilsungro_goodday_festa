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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_chat_reads: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          read_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          read_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          read_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      franchise_payment_methods: {
        Row: {
          created_at: string | null
          franchise_id: string
          id: string
          method_name: string
          method_type: string | null
          rate: number | null
        }
        Insert: {
          created_at?: string | null
          franchise_id: string
          id?: string
          method_name: string
          method_type?: string | null
          rate?: number | null
        }
        Update: {
          created_at?: string | null
          franchise_id?: string
          id?: string
          method_name?: string
          method_type?: string | null
          rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "franchise_payment_methods_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchises: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gifticon_average_prices: {
        Row: {
          average_price: number
          brand: string
          created_at: string | null
          id: string
          last_updated_at: string | null
          product_name: string
          sample_count: number
        }
        Insert: {
          average_price: number
          brand: string
          created_at?: string | null
          id?: string
          last_updated_at?: string | null
          product_name: string
          sample_count?: number
        }
        Update: {
          average_price?: number
          brand?: string
          created_at?: string | null
          id?: string
          last_updated_at?: string | null
          product_name?: string
          sample_count?: number
        }
        Relationships: []
      }
      gifticon_recognition_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          recognition_result: Json | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          recognition_result?: Json | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          recognition_result?: Json | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gifticons: {
        Row: {
          barcode: string | null
          brand: string
          created_at: string | null
          expiry_date: string
          id: string
          image: string
          is_selling: boolean | null
          name: string
          original_price: number
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand: string
          created_at?: string | null
          expiry_date: string
          id?: string
          image: string
          is_selling?: boolean | null
          name: string
          original_price: number
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string
          created_at?: string | null
          expiry_date?: string
          id?: string
          image?: string
          is_selling?: boolean | null
          name?: string
          original_price?: number
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          id: string
          method: string
          status: string
          store: string
          time: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          id?: string
          method: string
          status: string
          store: string
          time: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          method?: string
          status?: string
          store?: string
          time?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          gifticons_count: number
          id: string
          name: string | null
          payment_count: number
          selling_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          gifticons_count?: number
          id: string
          name?: string | null
          payment_count?: number
          selling_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          gifticons_count?: number
          id?: string
          name?: string | null
          payment_count?: number
          selling_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          created_at: string | null
          franchise_id: string
          free_parking: boolean | null
          gifticon_available: boolean | null
          id: string
          kakao_place_id: string | null
          local_currency_available: boolean | null
          local_currency_discount_rate: number | null
          name: string
          parking_available: boolean | null
          parking_size: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          franchise_id: string
          free_parking?: boolean | null
          gifticon_available?: boolean | null
          id?: string
          kakao_place_id?: string | null
          local_currency_available?: boolean | null
          local_currency_discount_rate?: number | null
          name: string
          parking_available?: boolean | null
          parking_size?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          franchise_id?: string
          free_parking?: boolean | null
          gifticon_available?: boolean | null
          id?: string
          kakao_place_id?: string | null
          local_currency_available?: boolean | null
          local_currency_discount_rate?: number | null
          name?: string
          parking_available?: boolean | null
          parking_size?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          page_name: string
          page_path: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page_name: string
          page_path: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page_name?: string
          page_path?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      used_gifticons: {
        Row: {
          available_at: string
          barcode: string
          created_at: string | null
          expiry_date: string
          id: string
          name: string
          original_price: number
          reserved_at: string | null
          reserved_by: string | null
          sale_price: number
          seller_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          available_at: string
          barcode: string
          created_at?: string | null
          expiry_date: string
          id?: string
          name: string
          original_price: number
          reserved_at?: string | null
          reserved_by?: string | null
          sale_price: number
          seller_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          available_at?: string
          barcode?: string
          created_at?: string | null
          expiry_date?: string
          id?: string
          name?: string
          original_price?: number
          reserved_at?: string | null
          reserved_by?: string | null
          sale_price?: number
          seller_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          cjone: boolean | null
          compose_coffee: boolean | null
          created_at: string | null
          ediya: boolean | null
          happy_point: boolean | null
          hpoint: boolean | null
          id: string
          kakaopay: boolean | null
          kbpay: boolean | null
          kt: boolean | null
          lg_uplus: boolean | null
          lpoint: boolean | null
          mega_coffee: boolean | null
          naverpay: boolean | null
          paik: boolean | null
          payco: boolean | null
          samsungpay: boolean | null
          shinhan: boolean | null
          skt: boolean | null
          starbucks: boolean | null
          tosspay: boolean | null
          twosome: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cjone?: boolean | null
          compose_coffee?: boolean | null
          created_at?: string | null
          ediya?: boolean | null
          happy_point?: boolean | null
          hpoint?: boolean | null
          id?: string
          kakaopay?: boolean | null
          kbpay?: boolean | null
          kt?: boolean | null
          lg_uplus?: boolean | null
          lpoint?: boolean | null
          mega_coffee?: boolean | null
          naverpay?: boolean | null
          paik?: boolean | null
          payco?: boolean | null
          samsungpay?: boolean | null
          shinhan?: boolean | null
          skt?: boolean | null
          starbucks?: boolean | null
          tosspay?: boolean | null
          twosome?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cjone?: boolean | null
          compose_coffee?: boolean | null
          created_at?: string | null
          ediya?: boolean | null
          happy_point?: boolean | null
          hpoint?: boolean | null
          id?: string
          kakaopay?: boolean | null
          kbpay?: boolean | null
          kt?: boolean | null
          lg_uplus?: boolean | null
          lpoint?: boolean | null
          mega_coffee?: boolean | null
          naverpay?: boolean | null
          paik?: boolean | null
          payco?: boolean | null
          samsungpay?: boolean | null
          shinhan?: boolean | null
          skt?: boolean | null
          starbucks?: boolean | null
          tosspay?: boolean | null
          twosome?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_reservations: {
        Args: never
        Returns: {
          cleaned_count: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      mark_expired_gifticons: {
        Args: never
        Returns: {
          expired_count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
