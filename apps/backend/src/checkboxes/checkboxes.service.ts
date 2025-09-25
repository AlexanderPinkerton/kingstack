import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface Checkbox {
  id: string;
  index: number;
  checked: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class CheckboxesService {
  private readonly logger = new Logger(CheckboxesService.name);
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async findAll(): Promise<Checkbox[]> {
    try {
      const { data, error } = await this.supabase
        .from("checkbox")
        .select("*")
        .order("index", { ascending: true });

      if (error) {
        this.logger.error("Error fetching checkboxes:", error);
        throw new Error(`Failed to fetch checkboxes: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error("Error in findAll:", error);
      throw error;
    }
  }

  async create(createCheckboxDto: { index: number; checked: boolean }): Promise<Checkbox> {
    try {
      const { data, error } = await this.supabase
        .from("checkbox")
        .insert([createCheckboxDto])
        .select()
        .single();

      if (error) {
        this.logger.error("Error creating checkbox:", error);
        throw new Error(`Failed to create checkbox: ${error.message}`);
      }

      this.logger.log(`Created checkbox: ${data.id} at index ${data.index}`);
      return data;
    } catch (error) {
      this.logger.error("Error in create:", error);
      throw error;
    }
  }

  async update(id: string, updateCheckboxDto: { index?: number; checked?: boolean }): Promise<Checkbox> {
    try {
      const { data, error } = await this.supabase
        .from("checkbox")
        .update(updateCheckboxDto)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        this.logger.error("Error updating checkbox:", error);
        throw new Error(`Failed to update checkbox: ${error.message}`);
      }

      this.logger.log(`Updated checkbox: ${id}`);
      return data;
    } catch (error) {
      this.logger.error("Error in update:", error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("checkbox")
        .delete()
        .eq("id", id);

      if (error) {
        this.logger.error("Error deleting checkbox:", error);
        throw new Error(`Failed to delete checkbox: ${error.message}`);
      }

      this.logger.log(`Deleted checkbox: ${id}`);
    } catch (error) {
      this.logger.error("Error in remove:", error);
      throw error;
    }
  }

  async initializeCheckboxes(count: number): Promise<{ message: string; count: number }> {
    try {
      // First, clear existing checkboxes
      const { error: deleteError } = await this.supabase
        .from("checkbox")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (deleteError) {
        this.logger.error("Error clearing existing checkboxes:", deleteError);
        throw new Error(`Failed to clear existing checkboxes: ${deleteError.message}`);
      }

      // Create new checkboxes
      const checkboxes = Array.from({ length: count }, (_, i) => ({
        index: i,
        checked: false,
      }));

      const { data, error } = await this.supabase
        .from("checkbox")
        .insert(checkboxes)
        .select();

      if (error) {
        this.logger.error("Error initializing checkboxes:", error);
        throw new Error(`Failed to initialize checkboxes: ${error.message}`);
      }

      this.logger.log(`Initialized ${data.length} checkboxes`);
      return { message: `Successfully initialized ${data.length} checkboxes`, count: data.length };
    } catch (error) {
      this.logger.error("Error in initializeCheckboxes:", error);
      throw error;
    }
  }
}
