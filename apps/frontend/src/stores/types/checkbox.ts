export interface CheckboxApiData {
  id: string;
  index: number;
  checked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CheckboxUiData {
  id: string;
  index: number;
  checked: boolean;
  created_at: Date;
  updated_at: Date;
}
