import { FC, ReactNode } from "react";

export const ThemedErrorText: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="text-red-400 text-center text-sm mt-2">{children}</div>
);
