
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"reason": string | null,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"reason"?: string | null,"target_id": string,"target_type": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"reason"?: string | null,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"availability_windows": {
                  Row: {
                    "end_at": string,"id": string,"start_at": string,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "end_at": string,"id"?: string,"start_at": string,"vehicle_id": string
                  }
                  Update: {
                    "end_at"?: string,"id"?: string,"start_at"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_windows_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_attempts": {
                  Row: {
                    "contact_name": string,"contact_phone": string,"created_at": string,"failure_code": string | null,"id": string,"idempotency_key": string,"occupancy_id": string | null,"quote_id": string,"request_hash": string,"result_booking_id": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_name"?: string,"contact_phone"?: string,"created_at"?: string,"failure_code"?: string | null,"id"?: string,"idempotency_key": string,"occupancy_id"?: string | null,"quote_id": string,"request_hash": string,"result_booking_id"?: string | null,"status": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "contact_name"?: string,"contact_phone"?: string,"created_at"?: string,"failure_code"?: string | null,"id"?: string,"idempotency_key"?: string,"occupancy_id"?: string | null,"quote_id"?: string,"request_hash"?: string,"result_booking_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_attempts_occupancy_id_fkey"
      columns: ["occupancy_id"]
isOneToOne: false
      referencedRelation: "occupancy"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_attempts_quote_id_fkey"
      columns: ["quote_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_attempts_result_booking_id_fkey"
      columns: ["result_booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "contact_name": string,"contact_phone": string,"created_at": string,"customer_id": string,"decline_reason": string | null,"id": string,"partner_approved_at": string | null,"partner_id": string,"pickup_at": string,"price_snapshot": NonNullable<Json>,"quote_id": string | null,"ready_at": string | null,"ready_by": string | null,"reference": string,"respond_by": string | null,"return_at": string,"state": string,"total_cents": number,"updated_at": string,"vehicle_id": string,"vehicle_snapshot": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_name"?: string,"contact_phone"?: string,"created_at"?: string,"customer_id": string,"decline_reason"?: string | null,"id"?: string,"partner_approved_at"?: string | null,"partner_id": string,"pickup_at": string,"price_snapshot": NonNullable<Json>,"quote_id"?: string | null,"ready_at"?: string | null,"ready_by"?: string | null,"reference": string,"respond_by"?: string | null,"return_at": string,"state": string,"total_cents": number,"updated_at"?: string,"vehicle_id": string,"vehicle_snapshot": NonNullable<Json>
                  }
                  Update: {
                    "contact_name"?: string,"contact_phone"?: string,"created_at"?: string,"customer_id"?: string,"decline_reason"?: string | null,"id"?: string,"partner_approved_at"?: string | null,"partner_id"?: string,"pickup_at"?: string,"price_snapshot"?: NonNullable<Json>,"quote_id"?: string | null,"ready_at"?: string | null,"ready_by"?: string | null,"reference"?: string,"respond_by"?: string | null,"return_at"?: string,"state"?: string,"total_cents"?: number,"updated_at"?: string,"vehicle_id"?: string,"vehicle_snapshot"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_partner_id_fkey"
      columns: ["partner_id"]
isOneToOne: false
      referencedRelation: "partners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_quote_id_fkey"
      columns: ["quote_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"external_demo_orders": {
                  Row: {
                    "confirmed_at": string | null,"contact_name": string | null,"contact_phone": string | null,"created_at": string,"customer_id": string,"demo_reference": string | null,"expires_at": string,"id": string,"listing_snapshot": NonNullable<Json>,"pickup_at": string,"provider_key": string,"provider_listing_id": string,"provider_name": string,"return_at": string,"search_lat": number,"search_lng": number,"search_radius_miles": number,"source_url": string,"state": string,"total_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string | null,"contact_name"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"customer_id": string,"demo_reference"?: string | null,"expires_at"?: string,"id"?: string,"listing_snapshot": NonNullable<Json>,"pickup_at": string,"provider_key": string,"provider_listing_id": string,"provider_name": string,"return_at": string,"search_lat": number,"search_lng": number,"search_radius_miles": number,"source_url": string,"state"?: string,"total_cents": number
                  }
                  Update: {
                    "confirmed_at"?: string | null,"contact_name"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"customer_id"?: string,"demo_reference"?: string | null,"expires_at"?: string,"id"?: string,"listing_snapshot"?: NonNullable<Json>,"pickup_at"?: string,"provider_key"?: string,"provider_listing_id"?: string,"provider_name"?: string,"return_at"?: string,"search_lat"?: number,"search_lng"?: number,"search_radius_miles"?: number,"source_url"?: string,"state"?: string,"total_cents"?: number
                  }
                  Relationships: [
                    
                  ]
                },"inspection_photos": {
                  Row: {
                    "category": string,"content_type": string,"id": string,"inspection_id": string,"size_bytes": number,"storage_path": string,"uploaded_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"content_type": string,"id"?: string,"inspection_id": string,"size_bytes": number,"storage_path": string,"uploaded_at"?: string
                  }
                  Update: {
                    "category"?: string,"content_type"?: string,"id"?: string,"inspection_id"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_photos_inspection_id_fkey"
      columns: ["inspection_id"]
isOneToOne: false
      referencedRelation: "inspections"
      referencedColumns: ["id"]
    }
                  ]
                },"inspections": {
                  Row: {
                    "acknowledged_at": string,"booking_id": string,"cleanliness": string,"created_at": string,"exterior_damage": string,"fuel_level": string,"id": string,"performed_by": string,"performed_role": string,"stage": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string,"booking_id": string,"cleanliness": string,"created_at"?: string,"exterior_damage": string,"fuel_level": string,"id"?: string,"performed_by": string,"performed_role": string,"stage": string
                  }
                  Update: {
                    "acknowledged_at"?: string,"booking_id"?: string,"cleanliness"?: string,"created_at"?: string,"exterior_damage"?: string,"fuel_level"?: string,"id"?: string,"performed_by"?: string,"performed_role"?: string,"stage"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspections_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"email_status": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"email_status"?: string,"id"?: string,"kind": string,"link"?: string | null,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"email_status"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"occupancy": {
                  Row: {
                    "active": boolean,"booking_id": string | null,"created_at": string,"expires_at": string | null,"id": string,"kind": string,"period": unknown,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"booking_id"?: string | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"kind": string,"period": unknown,"vehicle_id": string
                  }
                  Update: {
                    "active"?: boolean,"booking_id"?: string | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"kind"?: string,"period"?: unknown,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "occupancy_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "occupancy_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"partner_applications": {
                  Row: {
                    "contact_email": string,"contact_phone": string | null,"decision_reason": string | null,"fleet_size": number,"id": string,"notes": string | null,"partner_id": string,"reviewed_at": string | null,"reviewer_id": string | null,"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_email": string,"contact_phone"?: string | null,"decision_reason"?: string | null,"fleet_size"?: number,"id"?: string,"notes"?: string | null,"partner_id": string,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"submitted_at"?: string
                  }
                  Update: {
                    "contact_email"?: string,"contact_phone"?: string | null,"decision_reason"?: string | null,"fleet_size"?: number,"id"?: string,"notes"?: string | null,"partner_id"?: string,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partner_applications_partner_id_fkey"
      columns: ["partner_id"]
isOneToOne: true
      referencedRelation: "partners"
      referencedColumns: ["id"]
    }
                  ]
                },"partners": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"kind": string,"owner_user_id": string,"updated_at": string,"verification_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id"?: string,"kind": string,"owner_user_id": string,"updated_at"?: string,"verification_status"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"kind"?: string,"owner_user_id"?: string,"updated_at"?: string,"verification_status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"attempt_id": string,"booking_id": string | null,"created_at": string,"currency": string,"detail": string | null,"id": string,"provider": string,"provider_ref": string,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"attempt_id": string,"booking_id"?: string | null,"created_at"?: string,"currency"?: string,"detail"?: string | null,"id"?: string,"provider": string,"provider_ref": string,"state": string
                  }
                  Update: {
                    "amount_cents"?: number,"attempt_id"?: string,"booking_id"?: string | null,"created_at"?: string,"currency"?: string,"detail"?: string | null,"id"?: string,"provider"?: string,"provider_ref"?: string,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "booking_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"pricing_policies": {
                  Row: {
                    "active_from": string,"formula": NonNullable<Json>,"id": string,"key": string,"label": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active_from"?: string,"formula": NonNullable<Json>,"id"?: string,"key": string,"label": string,"version": number
                  }
                  Update: {
                    "active_from"?: string,"formula"?: NonNullable<Json>,"id"?: string,"key"?: string,"label"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "account_status": string,"created_at": string,"display_name": string,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_status"?: string,"created_at"?: string,"display_name"?: string,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "account_status"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"providers": {
                  Row: {
                    "adapter_key": string,"capability": string,"enabled": boolean,"id": string,"is_mock": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adapter_key": string,"capability": string,"enabled"?: boolean,"id"?: string,"is_mock"?: boolean,"name": string
                  }
                  Update: {
                    "adapter_key"?: string,"capability"?: string,"enabled"?: boolean,"id"?: string,"is_mock"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quotes": {
                  Row: {
                    "breakdown": NonNullable<Json>,"created_at": string,"expires_at": string,"id": string,"pickup_at": string,"policy_version": string,"return_at": string,"total_cents": number,"user_id": string | null,"vehicle_id": string,"vehicle_snapshot": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "breakdown": NonNullable<Json>,"created_at"?: string,"expires_at": string,"id"?: string,"pickup_at": string,"policy_version": string,"return_at": string,"total_cents": number,"user_id"?: string | null,"vehicle_id": string,"vehicle_snapshot": NonNullable<Json>
                  }
                  Update: {
                    "breakdown"?: NonNullable<Json>,"created_at"?: string,"expires_at"?: string,"id"?: string,"pickup_at"?: string,"policy_version"?: string,"return_at"?: string,"total_cents"?: number,"user_id"?: string | null,"vehicle_id"?: string,"vehicle_snapshot"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotes_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_searches": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"query": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"query": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"query"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"vehicle_photos": {
                  Row: {
                    "id": string,"is_primary": boolean,"position": number,"storage_path": string,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_primary"?: boolean,"position"?: number,"storage_path": string,"vehicle_id": string
                  }
                  Update: {
                    "id"?: string,"is_primary"?: boolean,"position"?: number,"storage_path"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_photos_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicles": {
                  Row: {
                    "approved_at": string | null,"booking_mode": string,"cancellation_policy": string,"color": string,"created_at": string,"daily_rate_cents": number,"description": string,"id": string,"latitude": number,"lifecycle_status": string,"location_label": string,"longitude": number,"make": string,"model": string,"partner_id": string,"pricing_policy_id": string,"provider_id": string,"public_code": string,"seats": number,"time_zone": string,"transmission": string,"updated_at": string,"vehicle_type": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"booking_mode"?: string,"cancellation_policy"?: string,"color"?: string,"created_at"?: string,"daily_rate_cents": number,"description"?: string,"id"?: string,"latitude": number,"lifecycle_status"?: string,"location_label": string,"longitude": number,"make": string,"model": string,"partner_id": string,"pricing_policy_id": string,"provider_id": string,"public_code": string,"seats": number,"time_zone"?: string,"transmission"?: string,"updated_at"?: string,"vehicle_type": string,"year": number
                  }
                  Update: {
                    "approved_at"?: string | null,"booking_mode"?: string,"cancellation_policy"?: string,"color"?: string,"created_at"?: string,"daily_rate_cents"?: number,"description"?: string,"id"?: string,"latitude"?: number,"lifecycle_status"?: string,"location_label"?: string,"longitude"?: number,"make"?: string,"model"?: string,"partner_id"?: string,"pricing_policy_id"?: string,"provider_id"?: string,"public_code"?: string,"seats"?: number,"time_zone"?: string,"transmission"?: string,"updated_at"?: string,"vehicle_type"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicles_partner_id_fkey"
      columns: ["partner_id"]
isOneToOne: false
      referencedRelation: "partners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicles_pricing_policy_id_fkey"
      columns: ["pricing_policy_id"]
isOneToOne: false
      referencedRelation: "pricing_policies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicles_provider_id_fkey"
      columns: ["provider_id"]
isOneToOne: false
      referencedRelation: "providers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "available_vehicle_ids":
{ Args: { "_pickup": string,"_return": string }; Returns: string[]
                           },
"begin_booking":
{ Args: { "_contact_name": string,"_contact_phone": string,"_hash": string,"_hold_seconds"?: number,"_key": string,"_quote": string,"_user": string }; Returns: Json
                           },
"expire_pending_requests":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finalize_booking":
{ Args: { "_attempt": string,"_detail"?: string,"_payment_ok": boolean,"_provider_ref": string }; Returns: Json
                           },
"hit_rate_limit":
{ Args: { "_bucket": string,"_limit": number,"_window_seconds": number }; Returns: boolean
                           },
"mark_ready_for_pickup":
{ Args: { "_booking": string,"_fuel_full": boolean,"_vehicle_clean": boolean }; Returns: undefined
                           },
"record_pickup_inspection":
{ Args: { "_actor": string,"_booking": string,"_cleanliness": string,"_exterior_damage": string,"_fuel_level": string,"_photos": Json }; Returns: string
                           },
"respond_to_booking":
{ Args: { "_approve": boolean,"_booking": string,"_reason"?: string }; Returns: Json
                           },
"review_listing":
{ Args: { "_approve": boolean,"_reason": string,"_vehicle": string }; Returns: undefined
                           },
"review_partner":
{ Args: { "_approve": boolean,"_partner": string,"_reason": string }; Returns: undefined
                           },
"submit_partner_application":
{ Args: { "_contact_email": string,"_contact_phone": string,"_display_name": string,"_fleet_size": number,"_kind": string,"_notes": string }; Returns: string
                           },
"vehicle_busy_periods":
{ Args: { "_from": string,"_to": string,"_vehicle": string }; Returns: {
              "end_at": string,"start_at": string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
