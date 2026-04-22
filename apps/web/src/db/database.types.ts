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
      account: {
        Row: {
          accessToken: string | null
          accessTokenExpiresAt: string | null
          accountId: string
          createdAt: string
          id: string
          idToken: string | null
          password: string | null
          providerId: string
          refreshToken: string | null
          refreshTokenExpiresAt: string | null
          scope: string | null
          updatedAt: string
          userId: string
        }
        Insert: {
          accessToken?: string | null
          accessTokenExpiresAt?: string | null
          accountId: string
          createdAt?: string
          id: string
          idToken?: string | null
          password?: string | null
          providerId: string
          refreshToken?: string | null
          refreshTokenExpiresAt?: string | null
          scope?: string | null
          updatedAt: string
          userId: string
        }
        Update: {
          accessToken?: string | null
          accessTokenExpiresAt?: string | null
          accountId?: string
          createdAt?: string
          id?: string
          idToken?: string | null
          password?: string | null
          providerId?: string
          refreshToken?: string | null
          refreshTokenExpiresAt?: string | null
          scope?: string | null
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          environment_id: string | null
          id: string
          metadata: Json
          org_id: string
          project_id: string | null
          target_key: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          environment_id?: string | null
          id: string
          metadata?: Json
          org_id: string
          project_id?: string | null
          target_key?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          environment_id?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          project_id?: string | null
          target_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      environments: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          project_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "environments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation: {
        Row: {
          createdAt: string
          email: string
          expiresAt: string
          id: string
          inviterId: string
          organizationId: string
          role: string | null
          status: string
        }
        Insert: {
          createdAt?: string
          email: string
          expiresAt: string
          id: string
          inviterId: string
          organizationId: string
          role?: string | null
          status: string
        }
        Update: {
          createdAt?: string
          email?: string
          expiresAt?: string
          id?: string
          inviterId?: string
          organizationId?: string
          role?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_inviterId_fkey"
            columns: ["inviterId"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      member: {
        Row: {
          createdAt: string
          id: string
          organizationId: string
          role: string
          userId: string
        }
        Insert: {
          createdAt: string
          id: string
          organizationId: string
          role: string
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          organizationId?: string
          role?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_organizationId_fkey"
            columns: ["organizationId"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      member_dek_wrap: {
        Row: {
          dek_version: number
          id: string
          org_id: string
          user_id: string
          wrapped_at: string
          wrapped_by_user_id: string
          wrapped_dek: string
        }
        Insert: {
          dek_version: number
          id: string
          org_id: string
          user_id: string
          wrapped_at?: string
          wrapped_by_user_id: string
          wrapped_dek: string
        }
        Update: {
          dek_version?: number
          id?: string
          org_id?: string
          user_id?: string
          wrapped_at?: string
          wrapped_by_user_id?: string
          wrapped_dek?: string
        }
        Relationships: []
      }
      organization: {
        Row: {
          createdAt: string
          id: string
          logo: string | null
          metadata: string | null
          name: string
          slug: string
          stripeCustomerId: string | null
        }
        Insert: {
          createdAt: string
          id: string
          logo?: string | null
          metadata?: string | null
          name: string
          slug: string
          stripeCustomerId?: string | null
        }
        Update: {
          createdAt?: string
          id?: string
          logo?: string | null
          metadata?: string | null
          name?: string
          slug?: string
          stripeCustomerId?: string | null
        }
        Relationships: []
      }
      organization_dek: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          org_id: string
          retired_at: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id: string
          org_id: string
          retired_at?: string | null
          version: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          org_id?: string
          retired_at?: string | null
          version?: number
        }
        Relationships: []
      }
      pending_member_wrap: {
        Row: {
          created_at: string
          id: string
          org_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          org_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      session: {
        Row: {
          activeOrganizationId: string | null
          createdAt: string
          expiresAt: string
          id: string
          ipAddress: string | null
          token: string
          updatedAt: string
          userAgent: string | null
          userId: string
        }
        Insert: {
          activeOrganizationId?: string | null
          createdAt?: string
          expiresAt: string
          id: string
          ipAddress?: string | null
          token: string
          updatedAt: string
          userAgent?: string | null
          userId: string
        }
        Update: {
          activeOrganizationId?: string | null
          createdAt?: string
          expiresAt?: string
          id?: string
          ipAddress?: string | null
          token?: string
          updatedAt?: string
          userAgent?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription: {
        Row: {
          billingInterval: string | null
          cancelAt: string | null
          cancelAtPeriodEnd: boolean | null
          canceledAt: string | null
          endedAt: string | null
          id: string
          periodEnd: string | null
          periodStart: string | null
          plan: string
          referenceId: string
          seats: number | null
          status: string
          stripeCustomerId: string | null
          stripeScheduleId: string | null
          stripeSubscriptionId: string | null
          trialEnd: string | null
          trialStart: string | null
        }
        Insert: {
          billingInterval?: string | null
          cancelAt?: string | null
          cancelAtPeriodEnd?: boolean | null
          canceledAt?: string | null
          endedAt?: string | null
          id: string
          periodEnd?: string | null
          periodStart?: string | null
          plan: string
          referenceId: string
          seats?: number | null
          status: string
          stripeCustomerId?: string | null
          stripeScheduleId?: string | null
          stripeSubscriptionId?: string | null
          trialEnd?: string | null
          trialStart?: string | null
        }
        Update: {
          billingInterval?: string | null
          cancelAt?: string | null
          cancelAtPeriodEnd?: boolean | null
          canceledAt?: string | null
          endedAt?: string | null
          id?: string
          periodEnd?: string | null
          periodStart?: string | null
          plan?: string
          referenceId?: string
          seats?: number | null
          status?: string
          stripeCustomerId?: string | null
          stripeScheduleId?: string | null
          stripeSubscriptionId?: string | null
          trialEnd?: string | null
          trialStart?: string | null
        }
        Relationships: []
      }
      user: {
        Row: {
          createdAt: string
          email: string
          emailVerified: boolean
          id: string
          image: string | null
          name: string
          stripeCustomerId: string | null
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          email: string
          emailVerified: boolean
          id: string
          image?: string | null
          name: string
          stripeCustomerId?: string | null
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          email?: string
          emailVerified?: boolean
          id?: string
          image?: string | null
          name?: string
          stripeCustomerId?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      user_vault: {
        Row: {
          enc_priv_nonce: string
          encrypted_private_key: string
          kdf_mem_limit: number
          kdf_ops_limit: number
          kdf_salt: string
          passphrase_updated_at: string
          public_key: string
          recovery_priv_nonce: string
          recovery_wrapped_private_key: string
          user_id: string
          vault_initialized_at: string
        }
        Insert: {
          enc_priv_nonce: string
          encrypted_private_key: string
          kdf_mem_limit: number
          kdf_ops_limit: number
          kdf_salt: string
          passphrase_updated_at?: string
          public_key: string
          recovery_priv_nonce: string
          recovery_wrapped_private_key: string
          user_id: string
          vault_initialized_at?: string
        }
        Update: {
          enc_priv_nonce?: string
          encrypted_private_key?: string
          kdf_mem_limit?: number
          kdf_ops_limit?: number
          kdf_salt?: string
          passphrase_updated_at?: string
          public_key?: string
          recovery_priv_nonce?: string
          recovery_wrapped_private_key?: string
          user_id?: string
          vault_initialized_at?: string
        }
        Relationships: []
      }
      verification: {
        Row: {
          createdAt: string
          expiresAt: string
          id: string
          identifier: string
          updatedAt: string
          value: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          id: string
          identifier: string
          updatedAt?: string
          value: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          id?: string
          identifier?: string
          updatedAt?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reorder_environments: {
        Args: { p_ordered_ids: string[]; p_project_id: string }
        Returns: undefined
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
