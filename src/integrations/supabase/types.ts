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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          kind: string
          notes: string | null
          preferred_date: string | null
          status: string
          tank_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          kind: string
          notes?: string | null
          preferred_date?: string | null
          status?: string
          tank_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          preferred_date?: string | null
          status?: string
          tank_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "customer_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          body: string | null
          category: string | null
          cover_image: string | null
          cover_path: string | null
          created_at: string
          excerpt: string | null
          featured_on_home: boolean
          home_order: number
          id: string
          published: boolean
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          tags: string[]
          title: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          body?: string | null
          category?: string | null
          cover_image?: string | null
          cover_path?: string | null
          created_at?: string
          excerpt?: string | null
          featured_on_home?: boolean
          home_order?: number
          id?: string
          published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          body?: string | null
          category?: string | null
          cover_image?: string | null
          cover_path?: string | null
          created_at?: string
          excerpt?: string | null
          featured_on_home?: boolean
          home_order?: number
          id?: string
          published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      consultation_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string
          goal: string | null
          id: string
          name: string
          phone: string
          size: string | null
          status: Database["public"]["Enums"]["request_status"]
          tank_type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details: string
          goal?: string | null
          id?: string
          name: string
          phone: string
          size?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tank_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string
          goal?: string | null
          id?: string
          name?: string
          phone?: string
          size?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tank_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          message: string
          name: string
          phone: string
          status: Database["public"]["Enums"]["request_status"]
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message: string
          name: string
          phone: string
          status?: Database["public"]["Enums"]["request_status"]
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string
          name?: string
          phone?: string
          status?: Database["public"]["Enums"]["request_status"]
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_tanks: {
        Row: {
          blue_light_hours: number | null
          city: string | null
          co2_hours: number | null
          co2_type: string | null
          coral_safe_light: string | null
          corals: Json | null
          created_at: string
          depth_cm: number | null
          dimensions: string | null
          filter_model: string | null
          filter_type: string | null
          has_ato: boolean | null
          has_co2: boolean | null
          has_coral: boolean | null
          has_heater: boolean | null
          has_plants: boolean | null
          has_protein_skimmer: boolean | null
          has_sump: boolean | null
          has_timer: boolean | null
          has_wave_maker: boolean | null
          heater_model: string | null
          heater_watts: number | null
          height_cm: number | null
          id: string
          image_path: string | null
          image_paths: string[]
          install_date: string | null
          last_water_change: string | null
          lighting_hours: number | null
          lighting_model: string | null
          lighting_type: string | null
          livestock: string | null
          livestock_items: Json
          marine_light_type: string | null
          marine_temperature: number | null
          name: string
          notes: string | null
          plants: Json
          primary_image: string | null
          protein_skimmer_model: string | null
          salinity: number | null
          salt_brand: string | null
          tank_type: string | null
          test_ammonia: number | null
          test_calcium: number | null
          test_kh: number | null
          test_magnesium: number | null
          test_nitrate: number | null
          test_nitrite: number | null
          test_ph: number | null
          test_phosphate: number | null
          test_salinity: number | null
          tests_updated_at: string | null
          updated_at: string
          user_id: string
          volume_liters: number | null
          water_change_percent: number | null
          wave_maker_model: string | null
          white_light_hours: number | null
          width_cm: number | null
        }
        Insert: {
          blue_light_hours?: number | null
          city?: string | null
          co2_hours?: number | null
          co2_type?: string | null
          coral_safe_light?: string | null
          corals?: Json | null
          created_at?: string
          depth_cm?: number | null
          dimensions?: string | null
          filter_model?: string | null
          filter_type?: string | null
          has_ato?: boolean | null
          has_co2?: boolean | null
          has_coral?: boolean | null
          has_heater?: boolean | null
          has_plants?: boolean | null
          has_protein_skimmer?: boolean | null
          has_sump?: boolean | null
          has_timer?: boolean | null
          has_wave_maker?: boolean | null
          heater_model?: string | null
          heater_watts?: number | null
          height_cm?: number | null
          id?: string
          image_path?: string | null
          image_paths?: string[]
          install_date?: string | null
          last_water_change?: string | null
          lighting_hours?: number | null
          lighting_model?: string | null
          lighting_type?: string | null
          livestock?: string | null
          livestock_items?: Json
          marine_light_type?: string | null
          marine_temperature?: number | null
          name: string
          notes?: string | null
          plants?: Json
          primary_image?: string | null
          protein_skimmer_model?: string | null
          salinity?: number | null
          salt_brand?: string | null
          tank_type?: string | null
          test_ammonia?: number | null
          test_calcium?: number | null
          test_kh?: number | null
          test_magnesium?: number | null
          test_nitrate?: number | null
          test_nitrite?: number | null
          test_ph?: number | null
          test_phosphate?: number | null
          test_salinity?: number | null
          tests_updated_at?: string | null
          updated_at?: string
          user_id: string
          volume_liters?: number | null
          water_change_percent?: number | null
          wave_maker_model?: string | null
          white_light_hours?: number | null
          width_cm?: number | null
        }
        Update: {
          blue_light_hours?: number | null
          city?: string | null
          co2_hours?: number | null
          co2_type?: string | null
          coral_safe_light?: string | null
          corals?: Json | null
          created_at?: string
          depth_cm?: number | null
          dimensions?: string | null
          filter_model?: string | null
          filter_type?: string | null
          has_ato?: boolean | null
          has_co2?: boolean | null
          has_coral?: boolean | null
          has_heater?: boolean | null
          has_plants?: boolean | null
          has_protein_skimmer?: boolean | null
          has_sump?: boolean | null
          has_timer?: boolean | null
          has_wave_maker?: boolean | null
          heater_model?: string | null
          heater_watts?: number | null
          height_cm?: number | null
          id?: string
          image_path?: string | null
          image_paths?: string[]
          install_date?: string | null
          last_water_change?: string | null
          lighting_hours?: number | null
          lighting_model?: string | null
          lighting_type?: string | null
          livestock?: string | null
          livestock_items?: Json
          marine_light_type?: string | null
          marine_temperature?: number | null
          name?: string
          notes?: string | null
          plants?: Json
          primary_image?: string | null
          protein_skimmer_model?: string | null
          salinity?: number | null
          salt_brand?: string | null
          tank_type?: string | null
          test_ammonia?: number | null
          test_calcium?: number | null
          test_kh?: number | null
          test_magnesium?: number | null
          test_nitrate?: number | null
          test_nitrite?: number | null
          test_ph?: number | null
          test_phosphate?: number | null
          test_salinity?: number | null
          tests_updated_at?: string | null
          updated_at?: string
          user_id?: string
          volume_liters?: number | null
          water_change_percent?: number | null
          wave_maker_model?: string | null
          white_light_hours?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      home_sections: {
        Row: {
          content: Json
          created_at: string
          enabled: boolean
          id: string
          section_key: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          section_key: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_reports: {
        Row: {
          actions: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          overall_status: string | null
          tank_id: string
          technician: string | null
          updated_at: string
          visit_date: string
        }
        Insert: {
          actions?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          overall_status?: string | null
          tank_id: string
          technician?: string | null
          updated_at?: string
          visit_date?: string
        }
        Update: {
          actions?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          overall_status?: string | null
          tank_id?: string
          technician?: string | null
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_reports_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "customer_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_categories: {
        Row: {
          created_at: string
          id: string
          label: string
          published: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          published?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          published?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          add_ons: string[] | null
          category: string
          category_label: string | null
          contents: Json
          cover: string | null
          cover_path: string | null
          created_at: string
          currency: string
          description: string | null
          duration: string | null
          equipment: Json
          equipment_warranty_enabled: boolean
          equipment_warranty_text: string | null
          featured: boolean
          featured_on_home: boolean
          height_cm: number | null
          home_order: number
          id: string
          image_paths: string[]
          images: string[]
          length_cm: number | null
          livestock_warranty: string | null
          livestock_warranty_enabled: boolean
          livestock_warranty_text: string | null
          location: string | null
          price_max: number | null
          price_min: number | null
          price_type: string
          published: boolean
          service_packages: string[] | null
          slug: string
          sort_order: number
          specs: Json
          title: string
          updated_at: string
          volume_liters: number | null
          water_system: string[] | null
          width_cm: number | null
          year: string | null
        }
        Insert: {
          add_ons?: string[] | null
          category?: string
          category_label?: string | null
          contents?: Json
          cover?: string | null
          cover_path?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration?: string | null
          equipment?: Json
          equipment_warranty_enabled?: boolean
          equipment_warranty_text?: string | null
          featured?: boolean
          featured_on_home?: boolean
          height_cm?: number | null
          home_order?: number
          id?: string
          image_paths?: string[]
          images?: string[]
          length_cm?: number | null
          livestock_warranty?: string | null
          livestock_warranty_enabled?: boolean
          livestock_warranty_text?: string | null
          location?: string | null
          price_max?: number | null
          price_min?: number | null
          price_type?: string
          published?: boolean
          service_packages?: string[] | null
          slug: string
          sort_order?: number
          specs?: Json
          title: string
          updated_at?: string
          volume_liters?: number | null
          water_system?: string[] | null
          width_cm?: number | null
          year?: string | null
        }
        Update: {
          add_ons?: string[] | null
          category?: string
          category_label?: string | null
          contents?: Json
          cover?: string | null
          cover_path?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration?: string | null
          equipment?: Json
          equipment_warranty_enabled?: boolean
          equipment_warranty_text?: string | null
          featured?: boolean
          featured_on_home?: boolean
          height_cm?: number | null
          home_order?: number
          id?: string
          image_paths?: string[]
          images?: string[]
          length_cm?: number | null
          livestock_warranty?: string | null
          livestock_warranty_enabled?: boolean
          livestock_warranty_text?: string | null
          location?: string | null
          price_max?: number | null
          price_min?: number | null
          price_type?: string
          published?: boolean
          service_packages?: string[] | null
          slug?: string
          sort_order?: number
          specs?: Json
          title?: string
          updated_at?: string
          volume_liters?: number | null
          water_system?: string[] | null
          width_cm?: number | null
          year?: string | null
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          admin_notes: string | null
          attachments: string[]
          city: string | null
          created_at: string
          customer_notes: string | null
          details: Json
          id: string
          name: string
          phone: string
          preferred_times: string | null
          status: Database["public"]["Enums"]["service_request_status"]
          tank_id: string | null
          type: Database["public"]["Enums"]["service_request_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          attachments?: string[]
          city?: string | null
          created_at?: string
          customer_notes?: string | null
          details?: Json
          id?: string
          name: string
          phone: string
          preferred_times?: string | null
          status?: Database["public"]["Enums"]["service_request_status"]
          tank_id?: string | null
          type: Database["public"]["Enums"]["service_request_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          attachments?: string[]
          city?: string | null
          created_at?: string
          customer_notes?: string | null
          details?: Json
          id?: string
          name?: string
          phone?: string
          preferred_times?: string | null
          status?: Database["public"]["Enums"]["service_request_status"]
          tank_id?: string | null
          type?: Database["public"]["Enums"]["service_request_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "customer_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          cta_label: string | null
          cta_type: string | null
          cta_url: string | null
          description: string | null
          faqs: Json
          features: Json
          full_description: string | null
          icon: string | null
          id: string
          image_path: string | null
          includes: Json
          is_featured: boolean
          linked_page_type: string
          linked_page_url: string | null
          meta_description: string | null
          meta_title: string | null
          price_label: string | null
          process_steps: Json
          published: boolean
          service_type: string | null
          short_description: string | null
          slug: string
          sort_order: number
          starting_price: number | null
          suitable_for: Json
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          cta_label?: string | null
          cta_type?: string | null
          cta_url?: string | null
          description?: string | null
          faqs?: Json
          features?: Json
          full_description?: string | null
          icon?: string | null
          id?: string
          image_path?: string | null
          includes?: Json
          is_featured?: boolean
          linked_page_type?: string
          linked_page_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          price_label?: string | null
          process_steps?: Json
          published?: boolean
          service_type?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number
          starting_price?: number | null
          suitable_for?: Json
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          cta_label?: string | null
          cta_type?: string | null
          cta_url?: string | null
          description?: string | null
          faqs?: Json
          features?: Json
          full_description?: string | null
          icon?: string | null
          id?: string
          image_path?: string | null
          includes?: Json
          is_featured?: boolean
          linked_page_type?: string
          linked_page_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          price_label?: string | null
          process_steps?: Json
          published?: boolean
          service_type?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          starting_price?: number | null
          suitable_for?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          content: Json
          id: string
          page_key: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          id?: string
          page_key: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          id?: string
          page_key?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          body: string
          created_at: string
          featured: boolean
          id: string
          image_path: string | null
          name: string
          rating: number
          role: string | null
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          body: string
          created_at?: string
          featured?: boolean
          id?: string
          image_path?: string | null
          name: string
          rating?: number
          role?: string | null
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          featured?: boolean
          id?: string
          image_path?: string | null
          name?: string
          rating?: number
          role?: string | null
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      water_tests: {
        Row: {
          ammonia: number | null
          created_at: string
          gh: number | null
          id: string
          kh: number | null
          nitrate: number | null
          nitrite: number | null
          notes: string | null
          ph: number | null
          salinity: number | null
          tank_id: string
          tds: number | null
          temperature: number | null
          test_date: string
        }
        Insert: {
          ammonia?: number | null
          created_at?: string
          gh?: number | null
          id?: string
          kh?: number | null
          nitrate?: number | null
          nitrite?: number | null
          notes?: string | null
          ph?: number | null
          salinity?: number | null
          tank_id: string
          tds?: number | null
          temperature?: number | null
          test_date?: string
        }
        Update: {
          ammonia?: number | null
          created_at?: string
          gh?: number | null
          id?: string
          kh?: number | null
          nitrate?: number | null
          nitrite?: number | null
          notes?: string | null
          ph?: number | null
          salinity?: number | null
          tank_id?: string
          tds?: number | null
          temperature?: number | null
          test_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_tests_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "customer_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "customer" | "staff"
      request_status: "new" | "in_progress" | "closed"
      service_request_status:
        | "new"
        | "in_review"
        | "contacted"
        | "awaiting_customer"
        | "scheduled"
        | "completed"
        | "cancelled"
      service_request_type: "design" | "visit" | "consultation" | "maintenance"
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
      app_role: ["admin", "customer", "staff"],
      request_status: ["new", "in_progress", "closed"],
      service_request_status: [
        "new",
        "in_review",
        "contacted",
        "awaiting_customer",
        "scheduled",
        "completed",
        "cancelled",
      ],
      service_request_type: ["design", "visit", "consultation", "maintenance"],
    },
  },
} as const
