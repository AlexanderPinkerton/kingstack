/**
 * Username Generation System
 * 
 * Generates usernames in the format: adjective + animal + number
 * Examples: "SwiftTiger42", "BoldEagle7", "CleverWolf13"
 */

export class UsernameGenerator {
  private static adjectives = [
    'Swift', 'Bold', 'Clever', 'Bright', 'Quick', 'Sharp', 'Smart', 'Wild',
    'Cool', 'Fast', 'Strong', 'Brave', 'Calm', 'Wise', 'Lucky', 'Happy',
    'Golden', 'Silver', 'Crystal', 'Diamond', 'Royal', 'Noble', 'Elite',
    'Mystic', 'Cosmic', 'Stellar', 'Lunar', 'Solar', 'Thunder', 'Lightning',
    'Fire', 'Ice', 'Storm', 'Wind', 'Earth', 'Water', 'Sky', 'Star'
  ];

  private static animals = [
    'Tiger', 'Eagle', 'Wolf', 'Lion', 'Bear', 'Fox', 'Hawk', 'Falcon',
    'Panther', 'Leopard', 'Jaguar', 'Lynx', 'Owl', 'Raven', 'Crow', 'Falcon',
    'Dragon', 'Phoenix', 'Griffin', 'Pegasus', 'Unicorn', 'Kraken', 'Viper',
    'Cobra', 'Python', 'Shark', 'Dolphin', 'Whale', 'Orca', 'Tiger', 'Lion',
    'Cheetah', 'Jaguar', 'Panther', 'Leopard', 'Lynx', 'Bobcat', 'Cougar'
  ];

  /**
   * Generate a random username
   */
  static generateUsername(): string {
    const adjective = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
    const animal = this.animals[Math.floor(Math.random() * this.animals.length)];
    const number = Math.floor(Math.random() * 999) + 1; // 1-999
    
    return `${adjective}${animal}${number}`;
  }

  /**
   * Generate multiple username suggestions
   */
  static generateSuggestions(count: number = 5): string[] {
    const suggestions = new Set<string>();
    
    while (suggestions.size < count) {
      suggestions.add(this.generateUsername());
    }
    
    return Array.from(suggestions);
  }

  /**
   * Validate username format
   * - 3-40 characters
   * - Alphanumeric, underscores, hyphens only
   */
  static validateUsername(username: string): { isValid: boolean; error?: string } {
    if (!username || typeof username !== 'string') {
      return { isValid: false, error: 'Username is required' };
    }

    if (username.length < 3) {
      return { isValid: false, error: 'Username must be at least 3 characters' };
    }

    if (username.length > 40) {
      return { isValid: false, error: 'Username must be 40 characters or less' };
    }

    // Only allow alphanumeric, underscores, and hyphens
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(username)) {
      return { isValid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
    }

    // Cannot start or end with underscore or hyphen
    if (username.startsWith('_') || username.startsWith('-') || 
        username.endsWith('_') || username.endsWith('-')) {
      return { isValid: false, error: 'Username cannot start or end with underscore or hyphen' };
    }

    return { isValid: true };
  }

  /**
   * Check if username is available (this would typically call a database check)
   * For now, this is a placeholder that would be implemented with actual DB calls
   */
  static async isUsernameAvailable(username: string): Promise<boolean> {
    // This would typically make a database call to check if username exists
    // For now, return true as a placeholder
    return true;
  }
}
