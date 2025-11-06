export interface NavLink {
  title: string;
  href: string;
  onClick?: () => void;
}

export interface NavbarProps {
  // Core layout props
  leftContent?: React.ReactNode;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;

  // Navigation props
  navLinks?: NavLink[];
  ctas?: CTA[];
  onNavLinkClick?: (tab: string) => void;

  // Logo props
  logo?: React.ReactNode;

  // Specialty components (for app-specific features)
  specialtyComponents?: React.ReactNode[];

  // Styling
  className?: string;
  height?: string;

  // Behavior
  sticky?: boolean;
  transparent?: boolean;
}

export interface CTA {
  title: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "outline" | "themed";
  className?: string;
}
