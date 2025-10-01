import { makeAutoObservable } from 'mobx';
import { isPlaygroundMode, getMockData } from '@kingstack/shapes';

export class PlaygroundStore {
  isPlaygroundMode = false;
  mockData: any = {};

  constructor() {
    makeAutoObservable(this);
    this.initialize();
  }

  private initialize() {
    this.isPlaygroundMode = isPlaygroundMode();
    
    if (this.isPlaygroundMode) {
      this.mockData = {
        todos: getMockData('todos'),
        posts: getMockData('posts'),
        checkboxes: getMockData('checkboxes'),
        users: getMockData('users')
      };
      
      console.log('🎮 Playground mode enabled - using mock data');
    }
  }

  // Simulate API delays for realistic UX
  private async simulateDelay(ms: number = 300) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Mock API methods that return promises with delays
  async fetchTodos() {
    await this.simulateDelay();
    return this.mockData.todos;
  }

  async fetchPosts() {
    await this.simulateDelay();
    return this.mockData.posts;
  }

  async fetchCheckboxes() {
    await this.simulateDelay();
    return this.mockData.checkboxes;
  }

  async fetchUsers() {
    await this.simulateDelay();
    return this.mockData.users;
  }

  // Mock mutation methods
  async createTodo(data: any) {
    await this.simulateDelay();
    const newTodo = {
      id: `temp-${Date.now()}`,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'playground-user'
    };
    this.mockData.todos.push(newTodo);
    return newTodo;
  }

  async updateTodo(id: string, data: any) {
    await this.simulateDelay();
    const todo = this.mockData.todos.find((t: any) => t.id === id);
    if (todo) {
      Object.assign(todo, data, { updated_at: new Date().toISOString() });
      return todo;
    }
    throw new Error('Todo not found');
  }

  async deleteTodo(id: string) {
    await this.simulateDelay();
    const index = this.mockData.todos.findIndex((t: any) => t.id === id);
    if (index > -1) {
      this.mockData.todos.splice(index, 1);
      return { id };
    }
    throw new Error('Todo not found');
  }

  async createPost(data: any) {
    await this.simulateDelay();
    const newPost = {
      id: `temp-${Date.now()}`,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'playground-user',
      published: true
    };
    this.mockData.posts.push(newPost);
    return newPost;
  }

  async updatePost(id: string, data: any) {
    await this.simulateDelay();
    const post = this.mockData.posts.find((p: any) => p.id === id);
    if (post) {
      Object.assign(post, data, { updated_at: new Date().toISOString() });
      return post;
    }
    throw new Error('Post not found');
  }

  async deletePost(id: string) {
    await this.simulateDelay();
    const index = this.mockData.posts.findIndex((p: any) => p.id === id);
    if (index > -1) {
      this.mockData.posts.splice(index, 1);
      return { id };
    }
    throw new Error('Post not found');
  }

  async updateCheckbox(id: string, data: any) {
    await this.simulateDelay();
    const checkbox = this.mockData.checkboxes.find((c: any) => c.id === id);
    if (checkbox) {
      Object.assign(checkbox, data, { updated_at: new Date().toISOString() });
      return checkbox;
    }
    throw new Error('Checkbox not found');
  }
}
