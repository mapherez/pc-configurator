type Props = {
  children: React.ReactNode
  className?: string
}

export default function AccordionList({ children, className }: Props) {
  return <div className={className ? className : ''}>{children}</div>
}
