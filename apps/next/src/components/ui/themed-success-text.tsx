import { FC, ReactNode } from "react";

export const ThemedSuccessText: FC<{ children: ReactNode }> = ({
  children,
}) => <div className="text-green-400 text-center text-sm mt-2">{children}</div>;
