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
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_date: string
          id: string
          label: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["accounting_period_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          label: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["accounting_period_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          label?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["accounting_period_status"]
          updated_at?: string
        }
        Relationships: []
      }
      accounting_settings: {
        Row: {
          accounting_start_date: string | null
          auto_post_enabled: boolean
          id: number
          updated_at: string
        }
        Insert: {
          accounting_start_date?: string | null
          auto_post_enabled?: boolean
          id?: number
          updated_at?: string
        }
        Update: {
          accounting_start_date?: string | null
          auto_post_enabled?: boolean
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          kind: string
          notes: string | null
          preferred_date: string | null
          service_request_id: string | null
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
          service_request_id?: string | null
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
          service_request_id?: string | null
          status?: string
          tank_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "customer_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      aqh_business_settings: {
        Row: {
          carried_forward_vat_credit: number
          commercial_registration: string | null
          company_name: string | null
          company_sub: string | null
          default_vat_rate: number | null
          email: string | null
          filing_frequency: string
          first_tax_period_start: string | null
          id: number
          invoice_prefix: string
          logo_url: string | null
          phone: string | null
          tax_address: string | null
          tax_basis: string
          updated_at: string | null
          vat_number: string | null
          vat_registered: boolean
        }
        Insert: {
          carried_forward_vat_credit?: number
          commercial_registration?: string | null
          company_name?: string | null
          company_sub?: string | null
          default_vat_rate?: number | null
          email?: string | null
          filing_frequency?: string
          first_tax_period_start?: string | null
          id?: number
          invoice_prefix?: string
          logo_url?: string | null
          phone?: string | null
          tax_address?: string | null
          tax_basis?: string
          updated_at?: string | null
          vat_number?: string | null
          vat_registered?: boolean
        }
        Update: {
          carried_forward_vat_credit?: number
          commercial_registration?: string | null
          company_name?: string | null
          company_sub?: string | null
          default_vat_rate?: number | null
          email?: string | null
          filing_frequency?: string
          first_tax_period_start?: string | null
          id?: number
          invoice_prefix?: string
          logo_url?: string | null
          phone?: string | null
          tax_address?: string | null
          tax_basis?: string
          updated_at?: string | null
          vat_number?: string | null
          vat_registered?: boolean
        }
        Relationships: []
      }
      aqh_finance_capital: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          entry_type: string
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      aqh_finance_manual_balances: {
        Row: {
          assets_value: number
          cash_actual: number
          cash_anchor_date: string | null
          created_at: string
          id: string
          inventory_value: number
          note: string | null
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assets_value?: number
          cash_actual?: number
          cash_anchor_date?: string | null
          created_at?: string
          id?: string
          inventory_value?: number
          note?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assets_value?: number
          cash_actual?: number
          cash_anchor_date?: string | null
          created_at?: string
          id?: string
          inventory_value?: number
          note?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      aqh_home_stats_cache: {
        Row: {
          customers: number
          projects: number
          singleton: boolean
          tanks: number
          updated_at: string
        }
        Insert: {
          customers?: number
          projects?: number
          singleton?: boolean
          tanks?: number
          updated_at?: string
        }
        Update: {
          customers?: number
          projects?: number
          singleton?: boolean
          tanks?: number
          updated_at?: string
        }
        Relationships: []
      }
      aqh_product_categories: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          name_ar: string
          parent_id: number | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          is_active?: boolean
          name_ar: string
          parent_id?: number | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          is_active?: boolean
          name_ar?: string
          parent_id?: number | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqh_product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "aqh_product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      aqh_product_suppliers: {
        Row: {
          cost: number | null
          created_at: string
          finance_supplier_id: string
          id: number
          is_preferred: boolean
          lead_time_days: number | null
          notes: string | null
          product_id: number
          supplier_sku: string | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          finance_supplier_id: string
          id?: never
          is_preferred?: boolean
          lead_time_days?: number | null
          notes?: string | null
          product_id: number
          supplier_sku?: string | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          finance_supplier_id?: string
          id?: never
          is_preferred?: boolean
          lead_time_days?: number | null
          notes?: string | null
          product_id?: number
          supplier_sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqh_product_suppliers_finance_supplier_id_fkey"
            columns: ["finance_supplier_id"]
            isOneToOne: false
            referencedRelation: "finance_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aqh_product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "aqh_products"
            referencedColumns: ["id"]
          },
        ]
      }
      aqh_products: {
        Row: {
          all_images: Json | null
          category: string | null
          category_id: number | null
          cost: number | null
          created_at: string | null
          current_qty: number | null
          id: number
          image_url: string | null
          is_active: boolean | null
          name_ar: string
          price: number | null
          restock_type: string | null
          salla_raw: Json | null
          sku: string
        }
        Insert: {
          all_images?: Json | null
          category?: string | null
          category_id?: number | null
          cost?: number | null
          created_at?: string | null
          current_qty?: number | null
          id?: never
          image_url?: string | null
          is_active?: boolean | null
          name_ar: string
          price?: number | null
          restock_type?: string | null
          salla_raw?: Json | null
          sku: string
        }
        Update: {
          all_images?: Json | null
          category?: string | null
          category_id?: number | null
          cost?: number | null
          created_at?: string | null
          current_qty?: number | null
          id?: never
          image_url?: string | null
          is_active?: boolean | null
          name_ar?: string
          price?: number | null
          restock_type?: string | null
          salla_raw?: Json | null
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "aqh_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "aqh_product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      aqh_quotes: {
        Row: {
          client_contact: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          delivery_terms: string | null
          discount: number | null
          discount_type: string | null
          grand_total: number | null
          id: number
          items: Json
          notes_text: string | null
          payment_terms: string | null
          prices_include_vat: boolean | null
          project_city: string | null
          project_name: string | null
          quote_no: string | null
          scope_text: string | null
          status: string | null
          subtotal: number | null
          updated_at: string | null
          vat_rate: number | null
          vat_total: number | null
          warranty_terms: string | null
        }
        Insert: {
          client_contact?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_terms?: string | null
          discount?: number | null
          discount_type?: string | null
          grand_total?: number | null
          id?: never
          items?: Json
          notes_text?: string | null
          payment_terms?: string | null
          prices_include_vat?: boolean | null
          project_city?: string | null
          project_name?: string | null
          quote_no?: string | null
          scope_text?: string | null
          status?: string | null
          subtotal?: number | null
          updated_at?: string | null
          vat_rate?: number | null
          vat_total?: number | null
          warranty_terms?: string | null
        }
        Update: {
          client_contact?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_terms?: string | null
          discount?: number | null
          discount_type?: string | null
          grand_total?: number | null
          id?: never
          items?: Json
          notes_text?: string | null
          payment_terms?: string | null
          prices_include_vat?: boolean | null
          project_city?: string | null
          project_name?: string | null
          quote_no?: string | null
          scope_text?: string | null
          status?: string | null
          subtotal?: number | null
          updated_at?: string | null
          vat_rate?: number | null
          vat_total?: number | null
          warranty_terms?: string | null
        }
        Relationships: []
      }
      aqh_restock_requests: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_name: string | null
          id: number
          items: Json
          items_count: number | null
          notes: string | null
          request_kind: string | null
          source: string | null
          status: string | null
          subtotal: number | null
          supplier_key: string | null
          total: number | null
          vat: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_name?: string | null
          id?: never
          items: Json
          items_count?: number | null
          notes?: string | null
          request_kind?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_key?: string | null
          total?: number | null
          vat?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_name?: string | null
          id?: never
          items?: Json
          items_count?: number | null
          notes?: string | null
          request_kind?: string | null
          source?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_key?: string | null
          total?: number | null
          vat?: number | null
        }
        Relationships: []
      }
      aqh_supplier_products: {
        Row: {
          barcode: string | null
          cost: number | null
          created_at: string | null
          id: number
          is_active: boolean | null
          item_no: string | null
          name: string
          needs_review: boolean | null
          supplier_key: string
          supplier_name: string
          vendor_supplier_id: string | null
        }
        Insert: {
          barcode?: string | null
          cost?: number | null
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          item_no?: string | null
          name: string
          needs_review?: boolean | null
          supplier_key: string
          supplier_name: string
          vendor_supplier_id?: string | null
        }
        Update: {
          barcode?: string | null
          cost?: number | null
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          item_no?: string | null
          name?: string
          needs_review?: boolean | null
          supplier_key?: string
          supplier_name?: string
          vendor_supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aqh_supplier_products_vendor_supplier_id_fkey"
            columns: ["vendor_supplier_id"]
            isOneToOne: false
            referencedRelation: "finance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      aquarium_care_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          image_paths: string[] | null
          log_type: string
          note: string | null
          note_category: string | null
          status: string | null
          tank_id: string
          user_id: string
          water_change_percentage: number | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          image_paths?: string[] | null
          log_type: string
          note?: string | null
          note_category?: string | null
          status?: string | null
          tank_id: string
          user_id: string
          water_change_percentage?: number | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          image_paths?: string[] | null
          log_type?: string
          note?: string | null
          note_category?: string | null
          status?: string | null
          tank_id?: string
          user_id?: string
          water_change_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aquarium_care_logs_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "customer_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      aquarium_issues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_paths: string[] | null
          issue_type: string
          service_request_id: string | null
          status: string
          tank_id: string
          updated_at: string
          user_id: string
          wants_followup: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_paths?: string[] | null
          issue_type: string
          service_request_id?: string | null
          status?: string
          tank_id: string
          updated_at?: string
          user_id: string
          wants_followup?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_paths?: string[] | null
          issue_type?: string
          service_request_id?: string | null
          status?: string
          tank_id?: string
          updated_at?: string
          user_id?: string
          wants_followup?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "aquarium_issues_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aquarium_issues_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "customer_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      aquarium_readings: {
        Row: {
          ammonia: number | null
          calcium: number | null
          created_at: string
          id: string
          kh: number | null
          magnesium: number | null
          nitrate: number | null
          nitrite: number | null
          note: string | null
          ph: number | null
          phosphate: number | null
          reading_date: string
          salinity: number | null
          tank_id: string
          tds: number | null
          temperature: number | null
          user_id: string
        }
        Insert: {
          ammonia?: number | null
          calcium?: number | null
          created_at?: string
          id?: string
          kh?: number | null
          magnesium?: number | null
          nitrate?: number | null
          nitrite?: number | null
          note?: string | null
          ph?: number | null
          phosphate?: number | null
          reading_date?: string
          salinity?: number | null
          tank_id: string
          tds?: number | null
          temperature?: number | null
          user_id: string
        }
        Update: {
          ammonia?: number | null
          calcium?: number | null
          created_at?: string
          id?: string
          kh?: number | null
          magnesium?: number | null
          nitrate?: number | null
          nitrite?: number | null
          note?: string | null
          ph?: number | null
          phosphate?: number | null
          reading_date?: string
          salinity?: number | null
          tank_id?: string
          tds?: number | null
          temperature?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aquarium_readings_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "customer_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      aquarium_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          status: string
          tank_id: string
          task_type: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          tank_id: string
          task_type: string
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          tank_id?: string
          task_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aquarium_tasks_tank_id_fkey"
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
          body_en: string | null
          category: string | null
          cover_image: string | null
          cover_path: string | null
          created_at: string
          excerpt: string | null
          excerpt_en: string | null
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
          title_en: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          body?: string | null
          body_en?: string | null
          category?: string | null
          cover_image?: string | null
          cover_path?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_en?: string | null
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
          title_en?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          body?: string | null
          body_en?: string | null
          category?: string | null
          cover_image?: string | null
          cover_path?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_en?: string | null
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
          title_en?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          account_subtype: string | null
          account_type: Database["public"]["Enums"]["coa_account_type"]
          allow_manual_entries: boolean
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name_ar: string
          name_en: string | null
          notes: string | null
          parent_id: string | null
          system_key: string | null
          updated_at: string
        }
        Insert: {
          account_subtype?: string | null
          account_type: Database["public"]["Enums"]["coa_account_type"]
          allow_manual_entries?: boolean
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name_ar: string
          name_en?: string | null
          notes?: string | null
          parent_id?: string | null
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          account_subtype?: string | null
          account_type?: Database["public"]["Enums"]["coa_account_type"]
          allow_manual_entries?: boolean
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name_ar?: string
          name_en?: string | null
          notes?: string | null
          parent_id?: string | null
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      credit_debit_note_items: {
        Row: {
          created_at: string
          description: string
          id: number
          line_subtotal: number
          line_tax_amount: number
          line_total: number
          note_id: number
          original_invoice_item_id: number | null
          quantity: number
          sort_order: number
          tax_code: Database["public"]["Enums"]["sales_invoice_tax_code"]
          tax_rate: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: number
          line_subtotal?: number
          line_tax_amount?: number
          line_total?: number
          note_id: number
          original_invoice_item_id?: number | null
          quantity?: number
          sort_order?: number
          tax_code?: Database["public"]["Enums"]["sales_invoice_tax_code"]
          tax_rate?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: number
          line_subtotal?: number
          line_tax_amount?: number
          line_total?: number
          note_id?: number
          original_invoice_item_id?: number | null
          quantity?: number
          sort_order?: number
          tax_code?: Database["public"]["Enums"]["sales_invoice_tax_code"]
          tax_rate?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_debit_note_items_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "credit_debit_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_debit_notes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: number
          issue_date: string
          note_number: string
          note_type: Database["public"]["Enums"]["credit_debit_note_type"]
          original_purchase_invoice_id: number | null
          original_sales_invoice_id: number | null
          overage_override_reason: string | null
          reason: string
          reversing_journal_entry_id: string | null
          status: Database["public"]["Enums"]["credit_debit_note_status"]
          subtotal: number
          supplier_id: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: number
          issue_date?: string
          note_number: string
          note_type: Database["public"]["Enums"]["credit_debit_note_type"]
          original_purchase_invoice_id?: number | null
          original_sales_invoice_id?: number | null
          overage_override_reason?: string | null
          reason: string
          reversing_journal_entry_id?: string | null
          status?: Database["public"]["Enums"]["credit_debit_note_status"]
          subtotal?: number
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: number
          issue_date?: string
          note_number?: string
          note_type?: Database["public"]["Enums"]["credit_debit_note_type"]
          original_purchase_invoice_id?: number | null
          original_sales_invoice_id?: number | null
          overage_override_reason?: string | null
          reason?: string
          reversing_journal_entry_id?: string | null
          status?: Database["public"]["Enums"]["credit_debit_note_status"]
          subtotal?: number
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_debit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_debit_notes_original_purchase_invoice_id_fkey"
            columns: ["original_purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_debit_notes_original_sales_invoice_id_fkey"
            columns: ["original_sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_debit_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "finance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_role_pages: {
        Row: {
          created_at: string
          id: string
          page_key: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_key: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_pages_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      finance_accounts: {
        Row: {
          account_kind: Database["public"]["Enums"]["finance_account_kind"]
          account_owner_type: Database["public"]["Enums"]["finance_account_owner_type"]
          allow_business_transactions: boolean
          created_at: string
          id: string
          include_in_company_cash_balance: boolean
          is_active: boolean
          name: string
          name_ar: string | null
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_kind?: Database["public"]["Enums"]["finance_account_kind"]
          account_owner_type?: Database["public"]["Enums"]["finance_account_owner_type"]
          allow_business_transactions?: boolean
          created_at?: string
          id?: string
          include_in_company_cash_balance?: boolean
          is_active?: boolean
          name: string
          name_ar?: string | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_kind?: Database["public"]["Enums"]["finance_account_kind"]
          account_owner_type?: Database["public"]["Enums"]["finance_account_owner_type"]
          allow_business_transactions?: boolean
          created_at?: string
          id?: string
          include_in_company_cash_balance?: boolean
          is_active?: boolean
          name?: string
          name_ar?: string | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_attachments: {
        Row: {
          attachment_type: string | null
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          related_bigint_id: number | null
          related_id: string | null
          related_type: Database["public"]["Enums"]["finance_related_type"]
          uploaded_by: string | null
        }
        Insert: {
          attachment_type?: string | null
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          related_bigint_id?: number | null
          related_id?: string | null
          related_type: Database["public"]["Enums"]["finance_related_type"]
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: string | null
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          related_bigint_id?: number | null
          related_id?: string | null
          related_type?: Database["public"]["Enums"]["finance_related_type"]
          uploaded_by?: string | null
        }
        Relationships: []
      }
      finance_audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          field_name: string | null
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          related_bigint_id: number | null
          related_id: string | null
          related_type: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          related_bigint_id?: number | null
          related_id?: string | null
          related_type: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          related_bigint_id?: number | null
          related_id?: string | null
          related_type?: string
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["finance_category_kind"]
          name: string
          parent_id: string | null
          system_slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["finance_category_kind"]
          name: string
          parent_id?: string | null
          system_slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["finance_category_kind"]
          name?: string
          parent_id?: string | null
          system_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expenses: {
        Row: {
          account_id: string | null
          account_type: Database["public"]["Enums"]["finance_account_type"]
          accountant_note: string | null
          accountant_status: Database["public"]["Enums"]["finance_accountant_status"]
          accounting_status: Database["public"]["Enums"]["finance_accounting_status"]
          amount: number
          attachment_status: Database["public"]["Enums"]["finance_attachment_status"]
          business_relation: Database["public"]["Enums"]["finance_business_relation"]
          created_at: string
          created_by: string | null
          customer_id: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          expense_date: string
          id: string
          import_batch_id: string | null
          internal_note: string | null
          internal_review_status: Database["public"]["Enums"]["finance_internal_review"]
          item_name: string
          main_category_id: string | null
          missing_purchase_invoice_reason: string | null
          month: string
          note: string | null
          payment_provider_id: string | null
          payment_type:
            | Database["public"]["Enums"]["purchase_payment_type"]
            | null
          purchase_invoice_id: number | null
          related_transaction_id: string | null
          sales_invoice_id: number | null
          settlement_id: string | null
          split_parent_id: string | null
          sub_category_id: string | null
          supplier_id: string | null
          supplier_name: string | null
          transaction_direction: Database["public"]["Enums"]["finance_transaction_direction"]
          transaction_type:
            | Database["public"]["Enums"]["finance_outgoing_type"]
            | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_type?: Database["public"]["Enums"]["finance_account_type"]
          accountant_note?: string | null
          accountant_status?: Database["public"]["Enums"]["finance_accountant_status"]
          accounting_status?: Database["public"]["Enums"]["finance_accounting_status"]
          amount: number
          attachment_status?: Database["public"]["Enums"]["finance_attachment_status"]
          business_relation?: Database["public"]["Enums"]["finance_business_relation"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expense_date: string
          id?: string
          import_batch_id?: string | null
          internal_note?: string | null
          internal_review_status?: Database["public"]["Enums"]["finance_internal_review"]
          item_name: string
          main_category_id?: string | null
          missing_purchase_invoice_reason?: string | null
          month: string
          note?: string | null
          payment_provider_id?: string | null
          payment_type?:
            | Database["public"]["Enums"]["purchase_payment_type"]
            | null
          purchase_invoice_id?: number | null
          related_transaction_id?: string | null
          sales_invoice_id?: number | null
          settlement_id?: string | null
          split_parent_id?: string | null
          sub_category_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          transaction_direction?: Database["public"]["Enums"]["finance_transaction_direction"]
          transaction_type?:
            | Database["public"]["Enums"]["finance_outgoing_type"]
            | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_type?: Database["public"]["Enums"]["finance_account_type"]
          accountant_note?: string | null
          accountant_status?: Database["public"]["Enums"]["finance_accountant_status"]
          accounting_status?: Database["public"]["Enums"]["finance_accounting_status"]
          amount?: number
          attachment_status?: Database["public"]["Enums"]["finance_attachment_status"]
          business_relation?: Database["public"]["Enums"]["finance_business_relation"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expense_date?: string
          id?: string
          import_batch_id?: string | null
          internal_note?: string | null
          internal_review_status?: Database["public"]["Enums"]["finance_internal_review"]
          item_name?: string
          main_category_id?: string | null
          missing_purchase_invoice_reason?: string | null
          month?: string
          note?: string | null
          payment_provider_id?: string | null
          payment_type?:
            | Database["public"]["Enums"]["purchase_payment_type"]
            | null
          purchase_invoice_id?: number | null
          related_transaction_id?: string | null
          sales_invoice_id?: number | null
          settlement_id?: string | null
          split_parent_id?: string | null
          sub_category_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          transaction_direction?: Database["public"]["Enums"]["finance_transaction_direction"]
          transaction_type?:
            | Database["public"]["Enums"]["finance_outgoing_type"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_split_parent_id_fkey"
            columns: ["split_parent_id"]
            isOneToOne: false
            referencedRelation: "finance_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "finance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_import_logs: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          duplicate_rows: number
          error_rows: number
          file_name: string
          id: string
          import_type: string
          imported_by: string | null
          imported_rows: number
          sheet_name: string | null
          skipped_rows: number
          status: string
          summary_json: Json | null
          total_rows: number
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          duplicate_rows?: number
          error_rows?: number
          file_name: string
          id?: string
          import_type: string
          imported_by?: string | null
          imported_rows?: number
          sheet_name?: string | null
          skipped_rows?: number
          status?: string
          summary_json?: Json | null
          total_rows?: number
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          duplicate_rows?: number
          error_rows?: number
          file_name?: string
          id?: string
          import_type?: string
          imported_by?: string | null
          imported_rows?: number
          sheet_name?: string | null
          skipped_rows?: number
          status?: string
          summary_json?: Json | null
          total_rows?: number
        }
        Relationships: []
      }
      finance_income_sources: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_incomes: {
        Row: {
          account_id: string | null
          account_type: Database["public"]["Enums"]["finance_account_type"]
          accountant_note: string | null
          accountant_status: Database["public"]["Enums"]["finance_accountant_status"]
          accounting_status: Database["public"]["Enums"]["finance_accounting_status"]
          amount: number
          attachment_status: Database["public"]["Enums"]["finance_attachment_status"]
          business_relation: Database["public"]["Enums"]["finance_business_relation"]
          collection_type:
            | Database["public"]["Enums"]["finance_collection_type"]
            | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          import_batch_id: string | null
          income_date: string
          income_source_id: string | null
          internal_note: string | null
          internal_review_status: Database["public"]["Enums"]["finance_internal_review"]
          month: string
          note: string | null
          payment_provider_id: string | null
          related_transaction_id: string | null
          sales_invoice_id: number | null
          settlement_id: string | null
          split_parent_id: string | null
          supplier_id: string | null
          transaction_direction: Database["public"]["Enums"]["finance_transaction_direction"]
          transaction_type:
            | Database["public"]["Enums"]["finance_incoming_type"]
            | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_type?: Database["public"]["Enums"]["finance_account_type"]
          accountant_note?: string | null
          accountant_status?: Database["public"]["Enums"]["finance_accountant_status"]
          accounting_status?: Database["public"]["Enums"]["finance_accounting_status"]
          amount: number
          attachment_status?: Database["public"]["Enums"]["finance_attachment_status"]
          business_relation?: Database["public"]["Enums"]["finance_business_relation"]
          collection_type?:
            | Database["public"]["Enums"]["finance_collection_type"]
            | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          import_batch_id?: string | null
          income_date: string
          income_source_id?: string | null
          internal_note?: string | null
          internal_review_status?: Database["public"]["Enums"]["finance_internal_review"]
          month: string
          note?: string | null
          payment_provider_id?: string | null
          related_transaction_id?: string | null
          sales_invoice_id?: number | null
          settlement_id?: string | null
          split_parent_id?: string | null
          supplier_id?: string | null
          transaction_direction?: Database["public"]["Enums"]["finance_transaction_direction"]
          transaction_type?:
            | Database["public"]["Enums"]["finance_incoming_type"]
            | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_type?: Database["public"]["Enums"]["finance_account_type"]
          accountant_note?: string | null
          accountant_status?: Database["public"]["Enums"]["finance_accountant_status"]
          accounting_status?: Database["public"]["Enums"]["finance_accounting_status"]
          amount?: number
          attachment_status?: Database["public"]["Enums"]["finance_attachment_status"]
          business_relation?: Database["public"]["Enums"]["finance_business_relation"]
          collection_type?:
            | Database["public"]["Enums"]["finance_collection_type"]
            | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          import_batch_id?: string | null
          income_date?: string
          income_source_id?: string | null
          internal_note?: string | null
          internal_review_status?: Database["public"]["Enums"]["finance_internal_review"]
          month?: string
          note?: string | null
          payment_provider_id?: string | null
          related_transaction_id?: string | null
          sales_invoice_id?: number | null
          settlement_id?: string | null
          split_parent_id?: string | null
          supplier_id?: string | null
          transaction_direction?: Database["public"]["Enums"]["finance_transaction_direction"]
          transaction_type?:
            | Database["public"]["Enums"]["finance_incoming_type"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_incomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_incomes_income_source_id_fkey"
            columns: ["income_source_id"]
            isOneToOne: false
            referencedRelation: "finance_income_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_incomes_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "aqh_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_incomes_split_parent_id_fkey"
            columns: ["split_parent_id"]
            isOneToOne: false
            referencedRelation: "finance_incomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_incomes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "finance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_suppliers: {
        Row: {
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          supplier_type: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          supplier_type?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          supplier_type?: string | null
          updated_at?: string
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
          section_type: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          section_key: string
          section_type?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          section_key?: string
          section_type?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          entry_number: string
          id: string
          period_id: string | null
          posted_at: string | null
          posted_by: string | null
          reversal_entry_id: string | null
          reversed_by_entry_id: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["journal_source_type"]
          status: Database["public"]["Enums"]["journal_entry_status"]
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date: string
          entry_number: string
          id?: string
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reversal_entry_id?: string | null
          reversed_by_entry_id?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["journal_source_type"]
          status?: Database["public"]["Enums"]["journal_entry_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reversal_entry_id?: string | null
          reversed_by_entry_id?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["journal_source_type"]
          status?: Database["public"]["Enums"]["journal_entry_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_entry_id_fkey"
            columns: ["reversal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_by_entry_id_fkey"
            columns: ["reversed_by_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          customer_id: string | null
          debit: number
          description: string | null
          finance_account_id: string | null
          id: string
          journal_entry_id: string
          line_order: number
          owner_settlement_reference: string | null
          supplier_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          customer_id?: string | null
          debit?: number
          description?: string | null
          finance_account_id?: string | null
          id?: string
          journal_entry_id: string
          line_order?: number
          owner_settlement_reference?: string | null
          supplier_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          customer_id?: string | null
          debit?: number
          description?: string | null
          finance_account_id?: string | null
          id?: string
          journal_entry_id?: string
          line_order?: number
          owner_settlement_reference?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "finance_suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          related_url: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          related_url?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          related_url?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_providers: {
        Row: {
          clearing_account_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          provider_code: Database["public"]["Enums"]["sales_payment_provider"]
          provider_type: Database["public"]["Enums"]["payment_provider_type"]
          rounding_tolerance: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          clearing_account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          provider_code: Database["public"]["Enums"]["sales_payment_provider"]
          provider_type: Database["public"]["Enums"]["payment_provider_type"]
          rounding_tolerance?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          clearing_account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          provider_code?: Database["public"]["Enums"]["sales_payment_provider"]
          provider_type?: Database["public"]["Enums"]["payment_provider_type"]
          rounding_tolerance?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_providers_clearing_account_id_fkey"
            columns: ["clearing_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_providers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "finance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settlement_lines: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          external_order_id: string | null
          id: string
          line_type: Database["public"]["Enums"]["payment_settlement_line_type"]
          provider_transaction_id: string | null
          raw_row: Json | null
          sales_invoice_id: number | null
          settlement_id: string
          transaction_date: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          external_order_id?: string | null
          id?: string
          line_type: Database["public"]["Enums"]["payment_settlement_line_type"]
          provider_transaction_id?: string | null
          raw_row?: Json | null
          sales_invoice_id?: number | null
          settlement_id: string
          transaction_date?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          external_order_id?: string | null
          id?: string
          line_type?: Database["public"]["Enums"]["payment_settlement_line_type"]
          provider_transaction_id?: string | null
          raw_row?: Json | null
          sales_invoice_id?: number | null
          settlement_id?: string
          transaction_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_settlement_lines_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_settlement_lines_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "payment_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settlements: {
        Row: {
          actual_bank_amount: number | null
          attachment_id: string | null
          bank_income_id: string | null
          created_at: string
          created_by: string | null
          difference_amount: number
          expected_net_amount: number
          fees_before_vat: number
          fees_vat_amount: number
          gross_sales_amount: number
          id: string
          notes: string | null
          other_deductions: number
          payout_fee: number
          period_end: string | null
          period_start: string | null
          provider_id: string
          refunds_amount: number
          reserve_held: number
          reserve_released: number
          settlement_date: string
          settlement_reference: string | null
          status: Database["public"]["Enums"]["payment_settlement_status"]
          updated_at: string
        }
        Insert: {
          actual_bank_amount?: number | null
          attachment_id?: string | null
          bank_income_id?: string | null
          created_at?: string
          created_by?: string | null
          difference_amount?: number
          expected_net_amount?: number
          fees_before_vat?: number
          fees_vat_amount?: number
          gross_sales_amount?: number
          id?: string
          notes?: string | null
          other_deductions?: number
          payout_fee?: number
          period_end?: string | null
          period_start?: string | null
          provider_id: string
          refunds_amount?: number
          reserve_held?: number
          reserve_released?: number
          settlement_date: string
          settlement_reference?: string | null
          status?: Database["public"]["Enums"]["payment_settlement_status"]
          updated_at?: string
        }
        Update: {
          actual_bank_amount?: number | null
          attachment_id?: string | null
          bank_income_id?: string | null
          created_at?: string
          created_by?: string | null
          difference_amount?: number
          expected_net_amount?: number
          fees_before_vat?: number
          fees_vat_amount?: number
          gross_sales_amount?: number
          id?: string
          notes?: string | null
          other_deductions?: number
          payout_fee?: number
          period_end?: string | null
          period_start?: string | null
          provider_id?: string
          refunds_amount?: number
          reserve_held?: number
          reserve_released?: number
          settlement_date?: string
          settlement_reference?: string | null
          status?: Database["public"]["Enums"]["payment_settlement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_settlements_bank_income_id_fkey"
            columns: ["bank_income_id"]
            isOneToOne: false
            referencedRelation: "finance_incomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_settlements_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          created_at: string
          display_name_for_customer: string | null
          email: string | null
          free_consults_total: number
          free_consults_used: number
          full_name: string | null
          id: string
          order_verified: boolean
          phone: string | null
          salla_order_no: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          display_name_for_customer?: string | null
          email?: string | null
          free_consults_total?: number
          free_consults_used?: number
          full_name?: string | null
          id: string
          order_verified?: boolean
          phone?: string | null
          salla_order_no?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          display_name_for_customer?: string | null
          email?: string | null
          free_consults_total?: number
          free_consults_used?: number
          full_name?: string | null
          id?: string
          order_verified?: boolean
          phone?: string | null
          salla_order_no?: string | null
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
          description_en: string | null
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
          media_order: string[]
          price_max: number | null
          price_min: number | null
          price_type: string
          published: boolean
          service_packages: string[] | null
          slug: string
          sort_order: number
          specs: Json
          summary_en: string | null
          title: string
          title_en: string | null
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
          description_en?: string | null
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
          media_order?: string[]
          price_max?: number | null
          price_min?: number | null
          price_type?: string
          published?: boolean
          service_packages?: string[] | null
          slug: string
          sort_order?: number
          specs?: Json
          summary_en?: string | null
          title: string
          title_en?: string | null
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
          description_en?: string | null
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
          media_order?: string[]
          price_max?: number | null
          price_min?: number | null
          price_type?: string
          published?: boolean
          service_packages?: string[] | null
          slug?: string
          sort_order?: number
          specs?: Json
          summary_en?: string | null
          title?: string
          title_en?: string | null
          updated_at?: string
          volume_liters?: number | null
          water_system?: string[] | null
          width_cm?: number | null
          year?: string | null
        }
        Relationships: []
      }
      provider_fee_invoice_settlements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          matched_fee_amount: number
          matched_vat_amount: number
          notes: string | null
          purchase_invoice_id: number
          settlement_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          matched_fee_amount?: number
          matched_vat_amount?: number
          notes?: string | null
          purchase_invoice_id: number
          settlement_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          matched_fee_amount?: number
          matched_vat_amount?: number
          notes?: string | null
          purchase_invoice_id?: number
          settlement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_fee_invoice_settlements_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_fee_invoice_settlements_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "payment_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_amount: number
          expense_category_id: string | null
          id: number
          line_subtotal: number
          line_tax_amount: number
          line_total: number
          product_id: number | null
          purchase_invoice_id: number
          quantity: number
          sort_order: number
          tax_code: Database["public"]["Enums"]["sales_invoice_tax_code"]
          tax_rate: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          discount_amount?: number
          expense_category_id?: string | null
          id?: number
          line_subtotal?: number
          line_tax_amount?: number
          line_total?: number
          product_id?: number | null
          purchase_invoice_id: number
          quantity?: number
          sort_order?: number
          tax_code?: Database["public"]["Enums"]["sales_invoice_tax_code"]
          tax_rate?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_amount?: number
          expense_category_id?: string | null
          id?: number
          line_subtotal?: number
          line_tax_amount?: number
          line_total?: number
          product_id?: number | null
          purchase_invoice_id?: number
          quantity?: number
          sort_order?: number
          tax_code?: Database["public"]["Enums"]["sales_invoice_tax_code"]
          tax_rate?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "aqh_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment_exception_reason: string | null
          attachment_required: boolean
          created_at: string
          created_by: string | null
          currency: string
          deductible_percentage: number
          deductible_vat_amount: number
          discount_amount: number
          due_date: string | null
          duplicate_override_reason: string | null
          fee_period_end: string | null
          fee_period_start: string | null
          id: number
          internal_notes: string | null
          internal_reference: string
          issue_date: string
          matched_fee_amount: number
          matched_vat_amount: number
          non_deductible_reason:
            | Database["public"]["Enums"]["purchase_non_deductible_reason"]
            | null
          non_deductible_vat_amount: number
          notes: string | null
          paid_amount: number
          paid_from_personal_account: boolean
          payment_provider_id: string | null
          payment_status: Database["public"]["Enums"]["purchase_payment_status"]
          provider_invoice_number: string | null
          purchase_type: Database["public"]["Enums"]["purchase_type"]
          remaining_amount: number
          reviewed_by: string | null
          reviewer_note: string | null
          status: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal: number
          supplier_id: string | null
          supplier_invoice_number: string | null
          supply_date: string | null
          taxable_amount: number
          total_amount: number
          unmatched_fee_amount: number
          unmatched_vat_amount: number
          updated_at: string
          vat_amount: number
          vat_deductibility: Database["public"]["Enums"]["purchase_vat_deductibility"]
          vat_document_status:
            | Database["public"]["Enums"]["vat_document_status"]
            | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_exception_reason?: string | null
          attachment_required?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          deductible_percentage?: number
          deductible_vat_amount?: number
          discount_amount?: number
          due_date?: string | null
          duplicate_override_reason?: string | null
          fee_period_end?: string | null
          fee_period_start?: string | null
          id?: number
          internal_notes?: string | null
          internal_reference: string
          issue_date?: string
          matched_fee_amount?: number
          matched_vat_amount?: number
          non_deductible_reason?:
            | Database["public"]["Enums"]["purchase_non_deductible_reason"]
            | null
          non_deductible_vat_amount?: number
          notes?: string | null
          paid_amount?: number
          paid_from_personal_account?: boolean
          payment_provider_id?: string | null
          payment_status?: Database["public"]["Enums"]["purchase_payment_status"]
          provider_invoice_number?: string | null
          purchase_type?: Database["public"]["Enums"]["purchase_type"]
          remaining_amount?: number
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          supplier_invoice_number?: string | null
          supply_date?: string | null
          taxable_amount?: number
          total_amount?: number
          unmatched_fee_amount?: number
          unmatched_vat_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_deductibility?: Database["public"]["Enums"]["purchase_vat_deductibility"]
          vat_document_status?:
            | Database["public"]["Enums"]["vat_document_status"]
            | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_exception_reason?: string | null
          attachment_required?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          deductible_percentage?: number
          deductible_vat_amount?: number
          discount_amount?: number
          due_date?: string | null
          duplicate_override_reason?: string | null
          fee_period_end?: string | null
          fee_period_start?: string | null
          id?: number
          internal_notes?: string | null
          internal_reference?: string
          issue_date?: string
          matched_fee_amount?: number
          matched_vat_amount?: number
          non_deductible_reason?:
            | Database["public"]["Enums"]["purchase_non_deductible_reason"]
            | null
          non_deductible_vat_amount?: number
          notes?: string | null
          paid_amount?: number
          paid_from_personal_account?: boolean
          payment_provider_id?: string | null
          payment_status?: Database["public"]["Enums"]["purchase_payment_status"]
          provider_invoice_number?: string | null
          purchase_type?: Database["public"]["Enums"]["purchase_type"]
          remaining_amount?: number
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          supplier_invoice_number?: string | null
          supply_date?: string | null
          taxable_amount?: number
          total_amount?: number
          unmatched_fee_amount?: number
          unmatched_vat_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_deductibility?: Database["public"]["Enums"]["purchase_vat_deductibility"]
          vat_document_status?:
            | Database["public"]["Enums"]["vat_document_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_payment_provider_id_fkey"
            columns: ["payment_provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "finance_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      request_assignment_events: {
        Row: {
          actor_id: string | null
          created_at: string
          department: string | null
          event_type: string
          from_staff_id: string | null
          id: string
          note: string | null
          request_id: string
          to_staff_id: string | null
          visible_to_customer: boolean
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          department?: string | null
          event_type: string
          from_staff_id?: string | null
          id?: string
          note?: string | null
          request_id: string
          to_staff_id?: string | null
          visible_to_customer?: boolean
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          department?: string | null
          event_type?: string
          from_staff_id?: string | null
          id?: string
          note?: string | null
          request_id?: string
          to_staff_id?: string | null
          visible_to_customer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "request_assignment_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_attachments: {
        Row: {
          bucket: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_visible_to_customer: boolean
          related_id: string | null
          related_type: string
          request_id: string
          uploaded_by: string | null
        }
        Insert: {
          bucket?: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_visible_to_customer?: boolean
          related_id?: string | null
          related_type?: string
          request_id: string
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_visible_to_customer?: boolean
          related_id?: string | null
          related_type?: string
          request_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          request_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          request_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          request_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_reports: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_visible_to_customer: boolean
          report_type: string
          request_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_visible_to_customer?: boolean
          report_type?: string
          request_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_visible_to_customer?: boolean
          report_type?: string
          request_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_reports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          is_visible_to_customer: boolean
          note: string | null
          request_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          is_visible_to_customer?: boolean
          note?: string | null
          request_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          is_visible_to_customer?: boolean
          note?: string | null
          request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          duplicate_rows: number
          error_rows: number
          file_name: string
          id: string
          imported_rows: number
          mapping_name: string | null
          mapping_snapshot: Json | null
          needs_review_rows: number
          notes: string | null
          sales_channel: Database["public"]["Enums"]["sales_channel_type"]
          sheet_name: string | null
          status: string
          summary_json: Json | null
          total_rows: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_rows?: number
          file_name: string
          id?: string
          imported_rows?: number
          mapping_name?: string | null
          mapping_snapshot?: Json | null
          needs_review_rows?: number
          notes?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel_type"]
          sheet_name?: string | null
          status?: string
          summary_json?: Json | null
          total_rows?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_rows?: number
          file_name?: string
          id?: string
          imported_rows?: number
          mapping_name?: string | null
          mapping_snapshot?: Json | null
          needs_review_rows?: number
          notes?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel_type"]
          sheet_name?: string | null
          status?: string
          summary_json?: Json | null
          total_rows?: number
          updated_at?: string
        }
        Relationships: []
      }
      sales_import_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          mapping: Json
          name: string
          sales_channel: Database["public"]["Enums"]["sales_channel_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          mapping: Json
          name: string
          sales_channel?: Database["public"]["Enums"]["sales_channel_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          mapping?: Json
          name?: string
          sales_channel?: Database["public"]["Enums"]["sales_channel_type"]
          updated_at?: string
        }
        Relationships: []
      }
      sales_invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_amount: number
          id: number
          invoice_id: number
          line_subtotal: number
          line_tax_amount: number
          line_total: number
          product_id: number | null
          quantity: number
          sort_order: number
          tax_code: Database["public"]["Enums"]["sales_invoice_tax_code"]
          tax_rate: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          discount_amount?: number
          id?: number
          invoice_id: number
          line_subtotal?: number
          line_tax_amount?: number
          line_total?: number
          product_id?: number | null
          quantity?: number
          sort_order?: number
          tax_code?: Database["public"]["Enums"]["sales_invoice_tax_code"]
          tax_rate?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_amount?: number
          id?: number
          invoice_id?: number
          line_subtotal?: number
          line_tax_amount?: number
          line_total?: number
          product_id?: number | null
          quantity?: number
          sort_order?: number
          tax_code?: Database["public"]["Enums"]["sales_invoice_tax_code"]
          tax_rate?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "aqh_products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_name_snapshot: string | null
          data_completeness_status: Database["public"]["Enums"]["sales_data_completeness"]
          discount_amount: number
          due_date: string | null
          external_invoice_number: string | null
          external_order_id: string | null
          id: number
          import_batch_id: string | null
          import_row_snapshot: Json | null
          internal_notes: string | null
          invoice_number: string
          issue_date: string
          net_amount: number | null
          notes: string | null
          order_date: string | null
          order_id: string | null
          order_status: string | null
          original_gross_amount: number | null
          paid_amount: number
          payment_provider:
            | Database["public"]["Enums"]["sales_payment_provider"]
            | null
          payment_status: Database["public"]["Enums"]["sales_invoice_payment_status"]
          refund_amount: number
          remaining_amount: number
          sales_channel: Database["public"]["Enums"]["sales_channel_type"]
          shipping_before_vat: number
          shipping_vat: number
          status: Database["public"]["Enums"]["sales_invoice_status"]
          subtotal: number
          supply_date: string | null
          taxable_amount: number
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          data_completeness_status?: Database["public"]["Enums"]["sales_data_completeness"]
          discount_amount?: number
          due_date?: string | null
          external_invoice_number?: string | null
          external_order_id?: string | null
          id?: number
          import_batch_id?: string | null
          import_row_snapshot?: Json | null
          internal_notes?: string | null
          invoice_number: string
          issue_date?: string
          net_amount?: number | null
          notes?: string | null
          order_date?: string | null
          order_id?: string | null
          order_status?: string | null
          original_gross_amount?: number | null
          paid_amount?: number
          payment_provider?:
            | Database["public"]["Enums"]["sales_payment_provider"]
            | null
          payment_status?: Database["public"]["Enums"]["sales_invoice_payment_status"]
          refund_amount?: number
          remaining_amount?: number
          sales_channel?: Database["public"]["Enums"]["sales_channel_type"]
          shipping_before_vat?: number
          shipping_vat?: number
          status?: Database["public"]["Enums"]["sales_invoice_status"]
          subtotal?: number
          supply_date?: string | null
          taxable_amount?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          data_completeness_status?: Database["public"]["Enums"]["sales_data_completeness"]
          discount_amount?: number
          due_date?: string | null
          external_invoice_number?: string | null
          external_order_id?: string | null
          id?: number
          import_batch_id?: string | null
          import_row_snapshot?: Json | null
          internal_notes?: string | null
          invoice_number?: string
          issue_date?: string
          net_amount?: number | null
          notes?: string | null
          order_date?: string | null
          order_id?: string | null
          order_status?: string | null
          original_gross_amount?: number | null
          paid_amount?: number
          payment_provider?:
            | Database["public"]["Enums"]["sales_payment_provider"]
            | null
          payment_status?: Database["public"]["Enums"]["sales_invoice_payment_status"]
          refund_amount?: number
          remaining_amount?: number
          sales_channel?: Database["public"]["Enums"]["sales_channel_type"]
          shipping_before_vat?: number
          shipping_vat?: number
          status?: Database["public"]["Enums"]["sales_invoice_status"]
          subtotal?: number
          supply_date?: string | null
          taxable_amount?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "sales_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          credit_note_id: number | null
          external_reference: string | null
          has_credit_note: boolean
          id: number
          import_batch_id: string | null
          invoice_id: number
          notes: string | null
          reason: string | null
          refund_date: string
          sales_channel: Database["public"]["Enums"]["sales_channel_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          credit_note_id?: number | null
          external_reference?: string | null
          has_credit_note?: boolean
          id?: number
          import_batch_id?: string | null
          invoice_id: number
          notes?: string | null
          reason?: string | null
          refund_date?: string
          sales_channel?: Database["public"]["Enums"]["sales_channel_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          credit_note_id?: number | null
          external_reference?: string | null
          has_credit_note?: boolean
          id?: number
          import_batch_id?: string | null
          invoice_id?: number
          notes?: string | null
          reason?: string | null
          refund_date?: string
          sales_channel?: Database["public"]["Enums"]["sales_channel_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_refunds_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_debit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_refunds_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "sales_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_refunds_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          accepted_by_staff_at: string | null
          admin_notes: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          assigned_to_staff_id: string | null
          assignment_department: string | null
          assignment_note: string | null
          assignment_status: Database["public"]["Enums"]["assignment_status"]
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
          accepted_by_staff_at?: string | null
          admin_notes?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          assigned_to_staff_id?: string | null
          assignment_department?: string | null
          assignment_note?: string | null
          assignment_status?: Database["public"]["Enums"]["assignment_status"]
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
          accepted_by_staff_at?: string | null
          admin_notes?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          assigned_to_staff_id?: string | null
          assignment_department?: string | null
          assignment_note?: string | null
          assignment_status?: Database["public"]["Enums"]["assignment_status"]
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
          description_en: string | null
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
          title_en: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          cta_label?: string | null
          cta_type?: string | null
          cta_url?: string | null
          description?: string | null
          description_en?: string | null
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
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          cta_label?: string | null
          cta_type?: string | null
          cta_url?: string | null
          description?: string | null
          description_en?: string | null
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
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_nav_links: {
        Row: {
          created_at: string
          external: boolean
          href: string
          id: string
          label: string
          label_en: string | null
          location: string
          open_in_new_tab: boolean
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          external?: boolean
          href: string
          id?: string
          label: string
          label_en?: string | null
          location: string
          open_in_new_tab?: boolean
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          external?: boolean
          href?: string
          id?: string
          label?: string
          label_en?: string | null
          location?: string
          open_in_new_tab?: boolean
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          content: Json
          content_en: Json | null
          id: string
          page_key: string
          title: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          content_en?: Json | null
          id?: string
          page_key: string
          title?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          content_en?: Json | null
          id?: string
          page_key?: string
          title?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tax_periods: {
        Row: {
          carried_credit_in: number
          carried_credit_out: number
          carried_credit_used: number
          created_at: string
          created_by: string | null
          due_date: string | null
          end_date: string
          filed_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["tax_period_status"]
          updated_at: string
        }
        Insert: {
          carried_credit_in?: number
          carried_credit_out?: number
          carried_credit_used?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          end_date: string
          filed_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["tax_period_status"]
          updated_at?: string
        }
        Update: {
          carried_credit_in?: number
          carried_credit_out?: number
          carried_credit_used?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          end_date?: string
          filed_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["tax_period_status"]
          updated_at?: string
        }
        Relationships: []
      }
      tax_return_snapshots: {
        Row: {
          created_at: string
          filed_at: string | null
          filed_by: string | null
          id: string
          line_items: Json
          override_reason: string | null
          period_id: string
          status: string
          summary: Json
        }
        Insert: {
          created_at?: string
          filed_at?: string | null
          filed_by?: string | null
          id?: string
          line_items?: Json
          override_reason?: string | null
          period_id: string
          status?: string
          summary?: Json
        }
        Update: {
          created_at?: string
          filed_at?: string | null
          filed_by?: string | null
          id?: string
          line_items?: Json
          override_reason?: string | null
          period_id?: string
          status?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tax_return_snapshots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
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
      ui_translations: {
        Row: {
          ar: string
          context: string | null
          en: string
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ar?: string
          context?: string | null
          en?: string
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ar?: string
          context?: string | null
          en?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_custom_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
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
      work_gallery_items: {
        Row: {
          care_level: string | null
          created_at: string
          display_order: number
          extra_images: string[]
          id: string
          image_path: string
          is_featured: boolean
          is_published: boolean
          linked_project_id: string | null
          size_category: string | null
          style: string | null
          suitable_for: string[]
          tank_type: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          care_level?: string | null
          created_at?: string
          display_order?: number
          extra_images?: string[]
          id?: string
          image_path: string
          is_featured?: boolean
          is_published?: boolean
          linked_project_id?: string | null
          size_category?: string | null
          style?: string | null
          suitable_for?: string[]
          tank_type?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          care_level?: string | null
          created_at?: string
          display_order?: number
          extra_images?: string[]
          id?: string
          image_path?: string
          is_featured?: boolean
          is_published?: boolean
          linked_project_id?: string | null
          size_category?: string | null
          style?: string | null
          suitable_for?: string[]
          tank_type?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_gallery_items_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      aqh_quote_products: {
        Row: {
          category: string | null
          cost: number | null
          image_url: string | null
          name: string | null
          price: number | null
          ref: string | null
          source: string | null
          supplier_cost: number | null
          supplier_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acct_id: { Args: { p_key: string }; Returns: string }
      acct_should_post: { Args: { p_date: string }; Returns: boolean }
      approve_credit_debit_note: {
        Args: { p_note_id: number; p_override_reason?: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: number
          issue_date: string
          note_number: string
          note_type: Database["public"]["Enums"]["credit_debit_note_type"]
          original_purchase_invoice_id: number | null
          original_sales_invoice_id: number | null
          overage_override_reason: string | null
          reason: string
          reversing_journal_entry_id: string | null
          status: Database["public"]["Enums"]["credit_debit_note_status"]
          subtotal: number
          supplier_id: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        SetofOptions: {
          from: "*"
          to: "credit_debit_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_purchase_invoice: {
        Args: { p_invoice_id: number }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attachment_exception_reason: string | null
          attachment_required: boolean
          created_at: string
          created_by: string | null
          currency: string
          deductible_percentage: number
          deductible_vat_amount: number
          discount_amount: number
          due_date: string | null
          duplicate_override_reason: string | null
          fee_period_end: string | null
          fee_period_start: string | null
          id: number
          internal_notes: string | null
          internal_reference: string
          issue_date: string
          matched_fee_amount: number
          matched_vat_amount: number
          non_deductible_reason:
            | Database["public"]["Enums"]["purchase_non_deductible_reason"]
            | null
          non_deductible_vat_amount: number
          notes: string | null
          paid_amount: number
          paid_from_personal_account: boolean
          payment_provider_id: string | null
          payment_status: Database["public"]["Enums"]["purchase_payment_status"]
          provider_invoice_number: string | null
          purchase_type: Database["public"]["Enums"]["purchase_type"]
          remaining_amount: number
          reviewed_by: string | null
          reviewer_note: string | null
          status: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal: number
          supplier_id: string | null
          supplier_invoice_number: string | null
          supply_date: string | null
          taxable_amount: number
          total_amount: number
          unmatched_fee_amount: number
          unmatched_vat_amount: number
          updated_at: string
          vat_amount: number
          vat_deductibility: Database["public"]["Enums"]["purchase_vat_deductibility"]
          vat_document_status:
            | Database["public"]["Enums"]["vat_document_status"]
            | null
        }
        SetofOptions: {
          from: "*"
          to: "purchase_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_sales_invoice: {
        Args: { p_invoice_id: number }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_name_snapshot: string | null
          data_completeness_status: Database["public"]["Enums"]["sales_data_completeness"]
          discount_amount: number
          due_date: string | null
          external_invoice_number: string | null
          external_order_id: string | null
          id: number
          import_batch_id: string | null
          import_row_snapshot: Json | null
          internal_notes: string | null
          invoice_number: string
          issue_date: string
          net_amount: number | null
          notes: string | null
          order_date: string | null
          order_id: string | null
          order_status: string | null
          original_gross_amount: number | null
          paid_amount: number
          payment_provider:
            | Database["public"]["Enums"]["sales_payment_provider"]
            | null
          payment_status: Database["public"]["Enums"]["sales_invoice_payment_status"]
          refund_amount: number
          remaining_amount: number
          sales_channel: Database["public"]["Enums"]["sales_channel_type"]
          shipping_before_vat: number
          shipping_vat: number
          status: Database["public"]["Enums"]["sales_invoice_status"]
          subtotal: number
          supply_date: string | null
          taxable_amount: number
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        SetofOptions: {
          from: "*"
          to: "sales_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aqh_bulk_update_products: {
        Args: {
          p_category_id?: number
          p_cost_pct?: number
          p_ids: number[]
          p_is_active?: boolean
          p_restock_type?: string
          p_supplier_id?: string
        }
        Returns: number
      }
      aqh_next_quote_no: { Args: never; Returns: string }
      cancel_credit_debit_note: {
        Args: { p_note_id: number; p_reason: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: number
          issue_date: string
          note_number: string
          note_type: Database["public"]["Enums"]["credit_debit_note_type"]
          original_purchase_invoice_id: number | null
          original_sales_invoice_id: number | null
          overage_override_reason: string | null
          reason: string
          reversing_journal_entry_id: string | null
          status: Database["public"]["Enums"]["credit_debit_note_status"]
          subtotal: number
          supplier_id: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        SetofOptions: {
          from: "*"
          to: "credit_debit_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cdn_recalc_totals: { Args: { p_note_id: number }; Returns: undefined }
      close_accounting_period: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      ensure_accounting_period: { Args: { p_date: string }; Returns: string }
      finance_archive_import_batch: {
        Args: { p_batch_id: string; p_reason: string }
        Returns: Json
      }
      finance_get_actor_names: {
        Args: { ids: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      finance_restore_import_batch: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      get_accounting_performance: {
        Args: { p_from: string; p_to: string }
        Returns: {
          ap_balance: number
          ar_balance: number
          cogs: number
          cogs_available: boolean
          deductible_input_vat: number
          gross_profit: number
          gross_sales: number
          inventory_value: number
          net_profit: number
          net_sales: number
          net_vat: number
          operating_expenses: number
          output_vat: number
          sales_discounts: number
        }[]
      }
      get_general_ledger: {
        Args: { p_account_id: string; p_from: string; p_to: string }
        Returns: {
          credit: number
          debit: number
          description: string
          entry_date: string
          entry_id: string
          entry_number: string
          running_balance: number
        }[]
      }
      get_home_hero_stats: {
        Args: never
        Returns: {
          customers: number
          projects: number
          tanks: number
        }[]
      }
      get_my_custom_allowed_pages: {
        Args: never
        Returns: {
          page_key: string
        }[]
      }
      get_owner_current_account: {
        Args: never
        Returns: {
          amount_due_from_owner: number
          amount_due_to_owner: number
          collected_by_owner: number
          company_to_owner: number
          net_owner_balance: number
          owner_to_company: number
          paid_by_owner: number
        }[]
      }
      get_trial_balance: {
        Args: { p_from: string; p_to: string }
        Returns: {
          account_id: string
          account_type: Database["public"]["Enums"]["coa_account_type"]
          balance: number
          code: string
          name_ar: string
          total_credit: number
          total_debit: number
        }[]
      }
      i_have_any_custom_role: { Args: never; Returns: boolean }
      next_credit_debit_note_number: {
        Args: { p_type: Database["public"]["Enums"]["credit_debit_note_type"] }
        Returns: string
      }
      next_journal_entry_number: { Args: never; Returns: string }
      next_purchase_invoice_number: { Args: never; Returns: string }
      next_sales_invoice_number: { Args: never; Returns: string }
      post_journal_entry: {
        Args: {
          p_description: string
          p_entry_date: string
          p_lines: Json
          p_source_id: string
          p_source_type: Database["public"]["Enums"]["journal_source_type"]
        }
        Returns: string
      }
      purchase_invoice_recalc_totals: {
        Args: { p_invoice_id: number }
        Returns: undefined
      }
      recalc_provider_fee_invoice_matches: {
        Args: { _invoice_id: number }
        Returns: undefined
      }
      reopen_accounting_period: {
        Args: { p_period_id: string; p_reason: string }
        Returns: undefined
      }
      reverse_journal_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: string
      }
      sales_invoice_recalc_totals: {
        Args: { p_invoice_id: number }
        Returns: undefined
      }
      sales_refunds_recalc: {
        Args: { p_invoice_id: number }
        Returns: undefined
      }
      vat_get_excluded_invoices: {
        Args: { p_period_id: string }
        Returns: {
          amount: number
          exclusion_reason: string
          invoice_date: string
          invoice_id: number
          party_name: string
          reference: string
          source: string
          status: string
          vat_amount: number
        }[]
      }
      vat_get_period_summary: { Args: { p_period_id: string }; Returns: Json }
      vat_get_purchase_lines: {
        Args: { p_period_id: string }
        Returns: {
          deductible_vat_amount: number
          has_attachment: boolean
          internal_reference: string
          invoice_date: string
          invoice_id: number
          non_deductible_reason: string
          non_deductible_vat_amount: number
          status: string
          supplier_id: string
          supplier_invoice_number: string
          supplier_name: string
          taxable_amount: number
          vat_amount: number
          vat_deductibility: string
        }[]
      }
      vat_get_sales_lines: {
        Args: { p_period_id: string }
        Returns: {
          customer_id: string
          customer_name: string
          invoice_date: string
          invoice_id: number
          invoice_number: string
          status: string
          tax_code: string
          taxable_amount: number
          total_amount: number
          vat_amount: number
        }[]
      }
      vat_mark_as_filed: {
        Args: { p_override_reason?: string; p_period_id: string }
        Returns: string
      }
      vat_validate_return: {
        Args: { p_period_id: string }
        Returns: {
          code: string
          message: string
          related_id: number
          severity: string
        }[]
      }
    }
    Enums: {
      accounting_period_status: "open" | "under_review" | "closed"
      app_role:
        | "admin"
        | "customer"
        | "staff"
        | "finance_view"
        | "finance_manage"
        | "finance_accountant"
        | "finance_export"
        | "finance_settings"
      assignment_status: "unassigned" | "assigned" | "accepted" | "transferred"
      coa_account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      credit_debit_note_status: "draft" | "approved" | "cancelled"
      credit_debit_note_type:
        | "sales_credit_note"
        | "sales_debit_note"
        | "purchase_credit_note"
        | "purchase_debit_note"
      finance_account_kind:
        | "bank"
        | "cash"
        | "wallet"
        | "payment_gateway"
        | "other"
      finance_account_owner_type: "company" | "owner"
      finance_account_type: "business" | "personal"
      finance_accountant_status:
        | "not_reviewed"
        | "reviewed"
        | "posted_to_qoyod"
        | "needs_fix"
      finance_accounting_status: "unclassified" | "classified" | "reviewed"
      finance_attachment_status: "attached" | "not_attached" | "not_required"
      finance_business_relation:
        | "business"
        | "personal"
        | "owner_settlement"
        | "internal_transfer"
        | "unclassified"
      finance_category_kind: "main" | "sub"
      finance_collection_type:
        | "invoice_collection"
        | "cash_sale"
        | "advance_payment"
        | "other"
      finance_incoming_type:
        | "customer_invoice_collection"
        | "cash_sale"
        | "owner_contribution"
        | "internal_transfer_in"
        | "supplier_refund"
        | "loan_received"
        | "other_income"
        | "unclassified_incoming"
        | "direct_sale"
        | "customer_advance"
        | "payment_provider_settlement"
        | "owner_collection"
        | "other_incoming"
      finance_internal_review: "unreviewed" | "reviewed"
      finance_outgoing_type:
        | "supplier_invoice_payment"
        | "operating_expense"
        | "inventory_purchase"
        | "asset_purchase"
        | "owner_withdrawal"
        | "internal_transfer_out"
        | "loan_payment"
        | "tax_or_government_payment"
        | "customer_refund"
        | "unclassified_outgoing"
        | "direct_operating_expense"
        | "salary_payment"
        | "government_fee"
        | "owner_reimbursement"
        | "other_outgoing"
      finance_related_type:
        | "income"
        | "expense"
        | "supplier"
        | "quote"
        | "purchase_invoice"
      finance_transaction_direction: "incoming" | "outgoing"
      journal_entry_status: "draft" | "posted" | "reversed"
      journal_source_type:
        | "manual"
        | "sales_invoice_approval"
        | "sales_invoice_collection"
        | "owner_reimbursement"
        | "purchase_invoice_approval"
        | "purchase_invoice_payment"
        | "owner_contribution"
        | "owner_withdrawal"
        | "internal_transfer"
      payment_provider_type: "payment_gateway" | "bnpl" | "marketplace"
      payment_settlement_line_type:
        | "sale"
        | "refund"
        | "fee"
        | "fee_vat"
        | "payout_fee"
        | "adjustment"
        | "reserve_held"
        | "reserve_released"
        | "rounding_difference"
        | "unexplained_transfer_fee"
      payment_settlement_status:
        | "draft"
        | "imported"
        | "under_review"
        | "matched"
        | "partially_matched"
        | "awaiting_payout"
        | "paid"
        | "cancelled"
      purchase_invoice_status:
        | "draft"
        | "under_review"
        | "approved"
        | "rejected"
        | "partially_paid"
        | "paid"
      purchase_non_deductible_reason:
        | "missing_tax_invoice"
        | "invalid_supplier_tax_data"
        | "personal_expense"
        | "unrelated_to_business"
        | "exempt_activity"
        | "duplicate_invoice"
        | "outside_tax_period"
        | "restricted_expense"
        | "other"
      purchase_payment_status: "unpaid" | "partially_paid" | "paid" | "overpaid"
      purchase_payment_type:
        | "supplier_invoice_payment"
        | "direct_expense"
        | "inventory_payment"
        | "asset_payment"
        | "owner_reimbursement"
        | "other"
      purchase_type:
        | "operating_expense"
        | "inventory"
        | "asset"
        | "service"
        | "government_fee"
        | "other"
      purchase_vat_deductibility:
        | "fully_deductible"
        | "partially_deductible"
        | "non_deductible"
        | "pending_review"
      request_status: "new" | "in_progress" | "closed"
      sales_channel_type: "manual" | "salla" | "direct" | "other"
      sales_data_completeness:
        | "complete"
        | "missing_original_invoice"
        | "missing_tax_details"
        | "needs_review"
        | "needs_credit_note"
      sales_invoice_payment_status:
        | "unpaid"
        | "partially_paid"
        | "paid"
        | "overpaid"
      sales_invoice_status:
        | "draft"
        | "approved"
        | "partially_paid"
        | "paid"
        | "cancelled"
      sales_invoice_tax_code:
        | "standard_15"
        | "zero_rated"
        | "exempt"
        | "out_of_scope"
      sales_payment_provider:
        | "salla_payments"
        | "tabby"
        | "tamara"
        | "bank_transfer"
        | "personal_account"
        | "business_account"
        | "cash"
        | "other"
      service_request_status:
        | "new"
        | "in_review"
        | "contacted"
        | "awaiting_customer"
        | "scheduled"
        | "completed"
        | "cancelled"
        | "proposal_sent"
        | "approved"
      service_request_type: "design" | "visit" | "consultation" | "maintenance"
      tax_period_status:
        | "open"
        | "under_review"
        | "ready"
        | "filed"
        | "paid"
        | "closed"
      vat_document_status:
        | "valid"
        | "missing"
        | "invalid_buyer_tax_data"
        | "pending_review"
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
      accounting_period_status: ["open", "under_review", "closed"],
      app_role: [
        "admin",
        "customer",
        "staff",
        "finance_view",
        "finance_manage",
        "finance_accountant",
        "finance_export",
        "finance_settings",
      ],
      assignment_status: ["unassigned", "assigned", "accepted", "transferred"],
      coa_account_type: ["asset", "liability", "equity", "revenue", "expense"],
      credit_debit_note_status: ["draft", "approved", "cancelled"],
      credit_debit_note_type: [
        "sales_credit_note",
        "sales_debit_note",
        "purchase_credit_note",
        "purchase_debit_note",
      ],
      finance_account_kind: [
        "bank",
        "cash",
        "wallet",
        "payment_gateway",
        "other",
      ],
      finance_account_owner_type: ["company", "owner"],
      finance_account_type: ["business", "personal"],
      finance_accountant_status: [
        "not_reviewed",
        "reviewed",
        "posted_to_qoyod",
        "needs_fix",
      ],
      finance_accounting_status: ["unclassified", "classified", "reviewed"],
      finance_attachment_status: ["attached", "not_attached", "not_required"],
      finance_business_relation: [
        "business",
        "personal",
        "owner_settlement",
        "internal_transfer",
        "unclassified",
      ],
      finance_category_kind: ["main", "sub"],
      finance_collection_type: [
        "invoice_collection",
        "cash_sale",
        "advance_payment",
        "other",
      ],
      finance_incoming_type: [
        "customer_invoice_collection",
        "cash_sale",
        "owner_contribution",
        "internal_transfer_in",
        "supplier_refund",
        "loan_received",
        "other_income",
        "unclassified_incoming",
        "direct_sale",
        "customer_advance",
        "payment_provider_settlement",
        "owner_collection",
        "other_incoming",
      ],
      finance_internal_review: ["unreviewed", "reviewed"],
      finance_outgoing_type: [
        "supplier_invoice_payment",
        "operating_expense",
        "inventory_purchase",
        "asset_purchase",
        "owner_withdrawal",
        "internal_transfer_out",
        "loan_payment",
        "tax_or_government_payment",
        "customer_refund",
        "unclassified_outgoing",
        "direct_operating_expense",
        "salary_payment",
        "government_fee",
        "owner_reimbursement",
        "other_outgoing",
      ],
      finance_related_type: [
        "income",
        "expense",
        "supplier",
        "quote",
        "purchase_invoice",
      ],
      finance_transaction_direction: ["incoming", "outgoing"],
      journal_entry_status: ["draft", "posted", "reversed"],
      journal_source_type: [
        "manual",
        "sales_invoice_approval",
        "sales_invoice_collection",
        "owner_reimbursement",
        "purchase_invoice_approval",
        "purchase_invoice_payment",
        "owner_contribution",
        "owner_withdrawal",
        "internal_transfer",
      ],
      payment_provider_type: ["payment_gateway", "bnpl", "marketplace"],
      payment_settlement_line_type: [
        "sale",
        "refund",
        "fee",
        "fee_vat",
        "payout_fee",
        "adjustment",
        "reserve_held",
        "reserve_released",
        "rounding_difference",
        "unexplained_transfer_fee",
      ],
      payment_settlement_status: [
        "draft",
        "imported",
        "under_review",
        "matched",
        "partially_matched",
        "awaiting_payout",
        "paid",
        "cancelled",
      ],
      purchase_invoice_status: [
        "draft",
        "under_review",
        "approved",
        "rejected",
        "partially_paid",
        "paid",
      ],
      purchase_non_deductible_reason: [
        "missing_tax_invoice",
        "invalid_supplier_tax_data",
        "personal_expense",
        "unrelated_to_business",
        "exempt_activity",
        "duplicate_invoice",
        "outside_tax_period",
        "restricted_expense",
        "other",
      ],
      purchase_payment_status: ["unpaid", "partially_paid", "paid", "overpaid"],
      purchase_payment_type: [
        "supplier_invoice_payment",
        "direct_expense",
        "inventory_payment",
        "asset_payment",
        "owner_reimbursement",
        "other",
      ],
      purchase_type: [
        "operating_expense",
        "inventory",
        "asset",
        "service",
        "government_fee",
        "other",
      ],
      purchase_vat_deductibility: [
        "fully_deductible",
        "partially_deductible",
        "non_deductible",
        "pending_review",
      ],
      request_status: ["new", "in_progress", "closed"],
      sales_channel_type: ["manual", "salla", "direct", "other"],
      sales_data_completeness: [
        "complete",
        "missing_original_invoice",
        "missing_tax_details",
        "needs_review",
        "needs_credit_note",
      ],
      sales_invoice_payment_status: [
        "unpaid",
        "partially_paid",
        "paid",
        "overpaid",
      ],
      sales_invoice_status: [
        "draft",
        "approved",
        "partially_paid",
        "paid",
        "cancelled",
      ],
      sales_invoice_tax_code: [
        "standard_15",
        "zero_rated",
        "exempt",
        "out_of_scope",
      ],
      sales_payment_provider: [
        "salla_payments",
        "tabby",
        "tamara",
        "bank_transfer",
        "personal_account",
        "business_account",
        "cash",
        "other",
      ],
      service_request_status: [
        "new",
        "in_review",
        "contacted",
        "awaiting_customer",
        "scheduled",
        "completed",
        "cancelled",
        "proposal_sent",
        "approved",
      ],
      service_request_type: ["design", "visit", "consultation", "maintenance"],
      tax_period_status: [
        "open",
        "under_review",
        "ready",
        "filed",
        "paid",
        "closed",
      ],
      vat_document_status: [
        "valid",
        "missing",
        "invalid_buyer_tax_data",
        "pending_review",
      ],
    },
  },
} as const
