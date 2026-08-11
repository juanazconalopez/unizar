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
      competition_fixtures: {
        Row: {
          away_score: number | null
          away_team: string
          competition_season_id: string
          home_score: number | null
          home_team: string
          id: string
          kickoff_time: string | null
          match_date: string
          round: string
          round_order: number
          source_match_id: string | null
          status: string
        }
        Insert: {
          away_score?: number | null
          away_team: string
          competition_season_id: string
          home_score?: number | null
          home_team: string
          id: string
          kickoff_time?: string | null
          match_date: string
          round: string
          round_order?: number
          source_match_id?: string | null
          status: string
        }
        Update: {
          away_score?: number | null
          away_team?: string
          competition_season_id?: string
          home_score?: number | null
          home_team?: string
          id?: string
          kickoff_time?: string | null
          match_date?: string
          round?: string
          round_order?: number
          source_match_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_fixtures_competition_season_id_fkey"
            columns: ["competition_season_id"]
            isOneToOne: false
            referencedRelation: "competition_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_player_stats: {
        Row: {
          competition_season_id: string
          conversions: number
          drops: number
          penalties: number
          player: string
          points: number
          red_cards: number
          team: string
          tries: number
          yellow_cards: number
        }
        Insert: {
          competition_season_id: string
          conversions?: number
          drops?: number
          penalties?: number
          player: string
          points?: number
          red_cards?: number
          team: string
          tries?: number
          yellow_cards?: number
        }
        Update: {
          competition_season_id?: string
          conversions?: number
          drops?: number
          penalties?: number
          player?: string
          points?: number
          red_cards?: number
          team?: string
          tries?: number
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_player_stats_competition_season_id_fkey"
            columns: ["competition_season_id"]
            isOneToOne: false
            referencedRelation: "competition_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_seasons: {
        Row: {
          id: string
          name: string
          source_label: string
          source_url: string
          starts_on: string
          synced_at: string
        }
        Insert: {
          id: string
          name: string
          source_label?: string
          source_url: string
          starts_on: string
          synced_at?: string
        }
        Update: {
          id?: string
          name?: string
          source_label?: string
          source_url?: string
          starts_on?: string
          synced_at?: string
        }
        Relationships: []
      }
      competition_standings: {
        Row: {
          competition_season_id: string
          defensive_bonus: number
          difference: number
          drawn: number
          lost: number
          offensive_bonus: number
          played: number
          points: number
          points_against: number
          points_for: number
          position: number
          team: string
          won: number
        }
        Insert: {
          competition_season_id: string
          defensive_bonus?: number
          difference?: number
          drawn?: number
          lost?: number
          offensive_bonus?: number
          played?: number
          points?: number
          points_against?: number
          points_for?: number
          position: number
          team: string
          won?: number
        }
        Update: {
          competition_season_id?: string
          defensive_bonus?: number
          difference?: number
          drawn?: number
          lost?: number
          offensive_bonus?: number
          played?: number
          points?: number
          points_against?: number
          points_for?: number
          position?: number
          team?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_standings_competition_season_id_fkey"
            columns: ["competition_season_id"]
            isOneToOne: false
            referencedRelation: "competition_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_sync_runs: {
        Row: {
          competition_season_id: string | null
          error_message: string | null
          finished_at: string | null
          fixtures_count: number | null
          id: string
          player_stats_count: number | null
          standings_count: number | null
          started_at: string
          status: string
        }
        Insert: {
          competition_season_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          fixtures_count?: number | null
          id?: string
          player_stats_count?: number | null
          standings_count?: number | null
          started_at?: string
          status: string
        }
        Update: {
          competition_season_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          fixtures_count?: number | null
          id?: string
          player_stats_count?: number | null
          standings_count?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_sync_runs_competition_season_id_fkey"
            columns: ["competition_season_id"]
            isOneToOne: false
            referencedRelation: "competition_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      match_availability: {
        Row: {
          comment: string | null
          match_id: string
          player_id: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at: string
        }
        Insert: {
          comment?: string | null
          match_id: string
          player_id: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
        }
        Update: {
          comment?: string | null
          match_id?: string
          player_id?: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_availability_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineup: {
        Row: {
          match_id: string
          player_id: string
          position: string | null
          role: Database["public"]["Enums"]["lineup_role"]
          slot_number: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          match_id: string
          player_id: string
          position?: string | null
          role: Database["public"]["Enums"]["lineup_role"]
          slot_number: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          match_id?: string
          player_id?: string
          position?: string | null
          role?: Database["public"]["Enums"]["lineup_role"]
          slot_number?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineup_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_home: boolean
          kickoff_time: string | null
          lineup_published: boolean
          match_date: string
          match_kind: Database["public"]["Enums"]["match_kind"]
          notes: string | null
          opponent: string
          rugby_format: Database["public"]["Enums"]["rugby_format"]
          season_id: string
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_home?: boolean
          kickoff_time?: string | null
          lineup_published?: boolean
          match_date: string
          match_kind?: Database["public"]["Enums"]["match_kind"]
          notes?: string | null
          opponent: string
          rugby_format?: Database["public"]["Enums"]["rugby_format"]
          season_id: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_home?: boolean
          kickoff_time?: string | null
          lineup_published?: boolean
          match_date?: string
          match_kind?: Database["public"]["Enums"]["match_kind"]
          notes?: string | null
          opponent?: string
          rugby_format?: Database["public"]["Enums"]["rugby_format"]
          season_id?: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          is_approved: boolean
          is_archived: boolean
          is_collaborator: boolean
          is_owner: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          is_approved?: boolean
          is_archived?: boolean
          is_collaborator?: boolean
          is_owner?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          is_approved?: boolean
          is_archived?: boolean
          is_collaborator?: boolean
          is_owner?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      season_players: {
        Row: {
          active_from: string
          active_until: string | null
          created_at: string
          id: string
          player_id: string
          season_id: string
        }
        Insert: {
          active_from: string
          active_until?: string | null
          created_at?: string
          id?: string
          player_id: string
          season_id: string
        }
        Update: {
          active_from?: string
          active_until?: string | null
          created_at?: string
          id?: string
          player_id?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_players_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          id: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_results: {
        Row: {
          completed_at: string
          fatigue_level: number
          performed_on: string
          player_id: string
          result_text: string
          task_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string
          fatigue_level: number
          performed_on: string
          player_id: string
          result_text: string
          task_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string
          fatigue_level?: number
          performed_on?: string
          player_id?: string
          result_text?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_results_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          season_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          training_type: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          season_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          training_type?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          season_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          training_type?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      team_announcements: {
        Row: {
          announcement_date: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          season_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          announcement_date: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          season_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          announcement_date?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          season_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_announcements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      training_attendance: {
        Row: {
          attended: boolean
          created_at: string
          marked_by: string
          player_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          attended?: boolean
          created_at?: string
          marked_by: string
          player_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          attended?: boolean
          created_at?: string
          marked_by?: string
          player_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          season_id: string | null
          session_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          season_id?: string | null
          session_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          season_id?: string | null
          session_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_can_edit_match: {
        Args: { checked_match_id: string }
        Returns: boolean
      }
      current_user_can_manage_tasks: { Args: never; Returns: boolean }
      current_user_is_active_player: { Args: never; Returns: boolean }
      current_user_is_approved: { Args: never; Returns: boolean }
      current_user_is_owner: { Args: never; Returns: boolean }
      normalize_display_name: { Args: { value: string }; Returns: string }
      player_can_access_match: {
        Args: { checked_match_id: string; checked_player_id: string }
        Returns: boolean
      }
      player_can_complete_task: {
        Args: {
          checked_performed_on: string
          checked_player_id: string
          checked_task_id: string
        }
        Returns: boolean
      }
      replace_competition_snapshot: {
        Args: {
          checked_fixtures: Json
          checked_player_stats: Json
          checked_season: Json
          checked_standings: Json
        }
        Returns: undefined
      }
      save_match_lineup: {
        Args: {
          checked_match_id: string
          lineup_entries: Json
          publish_lineup: boolean
        }
        Returns: undefined
      }
      save_training_attendance: {
        Args: {
          attendance_date: string
          attended_player_ids: string[]
          checked_player_ids: string[]
        }
        Returns: undefined
      }
    }
    Enums: {
      availability_status: "available" | "doubt" | "unavailable"
      lineup_role: "starter" | "substitute"
      match_kind: "official" | "friendly"
      match_status: "draft" | "published" | "cancelled" | "completed"
      rugby_format: "xv" | "sevens"
      task_status: "draft" | "published" | "cancelled"
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
      availability_status: ["available", "doubt", "unavailable"],
      lineup_role: ["starter", "substitute"],
      match_kind: ["official", "friendly"],
      match_status: ["draft", "published", "cancelled", "completed"],
      rugby_format: ["xv", "sevens"],
      task_status: ["draft", "published", "cancelled"],
    },
  },
} as const
