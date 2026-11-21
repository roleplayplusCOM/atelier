import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Dark-only toaster (the app has no theme switch). */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "!bg-card !border-0 !shadow-[var(--shadow-m)] !text-foreground !rounded-[16px] !font-sans",
          description: "!text-white/60",
          actionButton: "!bg-brand !text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
