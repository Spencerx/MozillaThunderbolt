import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { JSX, mergeProps, splitProps } from 'solid-js'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(mergeProps({ variant: 'default', size: 'default' }, props), ['variant', 'size', 'class', 'children'])

  type VariantType = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | undefined | null
  type SizeType = 'default' | 'sm' | 'lg' | 'icon' | undefined | null

  return (
    <button
      class={cn(
        buttonVariants({
          variant: local.variant as VariantType,
          size: local.size as SizeType,
          className: local.class,
        })
      )}
      {...others}
    >
      {local.children}
    </button>
  )
}

export { buttonVariants }
