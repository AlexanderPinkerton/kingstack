import { EntityAPI } from "../optimistic-store-pattern";
import { fetchWithAuth } from "../utils";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTodoDto {
  title: string;
}

export interface UpdateTodoDto {
  title?: string;
  done?: boolean;
}

export class TodoAPI implements EntityAPI<Todo, CreateTodoDto, UpdateTodoDto> {
  private baseUrl: string;
  private token: string;
  
  constructor(token: string) {
    // Use the same backend URL pattern as the existing postStore
    this.baseUrl = process.env.NEXT_PUBLIC_NEST_BACKEND_URL || 'http://localhost:3000';
    this.token = token;
  }

  private makeRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetchWithAuth(
      this.token,
      `${this.baseUrl}${endpoint}`,
      options
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  list = async (): Promise<Todo[]> => {
    console.log('📡 API: Fetching todos from backend');
    return this.makeRequest<Todo[]>('/todos');
  }

  create = async (data: CreateTodoDto): Promise<Todo> => {
    console.log('📡 API: Creating todo', data);
    return this.makeRequest<Todo>('/todos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  update = async (id: string, data: UpdateTodoDto): Promise<Todo> => {
    console.log('📡 API: Updating todo', id, data);
    return this.makeRequest<Todo>(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete = async (id: string): Promise<{ id: string }> => {
    console.log('📡 API: Deleting todo', id);
    await this.makeRequest(`/todos/${id}`, {
      method: 'DELETE',
    });
    return { id };
  }
}
