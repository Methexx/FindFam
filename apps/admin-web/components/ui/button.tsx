import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-[background-color,box-shadow,color,transform,filter] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        gradient:
          'rounded-full text-white bg-[linear-gradient(135deg,hsl(var(--brand-strong)),hsl(var(--brand)))] shadow-md shadow-black/20 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-glow active:translate-y-0',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Shows a spinner and disables the button.
   *
   * Every form was doing `{isSubmitting ? 'Saving…' : 'Save'}` by hand, which
   * meant each one decided separately whether to also disable itself — and
   * changing the label mid-press moves the button's own width under the
   * cursor. Keeping the label and adding a spinner leaves it still.
   */
  loading?: boolean;
}

// No `asChild`: links that need button styling use `buttonVariants()` on the
// <Link> directly, which is what every call site here already does. Radix
// triggers wrapping this with their own `asChild` work regardless, since they
// clone onto the forwarded ref.
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        // A loading button must not be pressable twice; leaving that to each
        // caller is how a double-submit gets shipped.
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Spinner /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
