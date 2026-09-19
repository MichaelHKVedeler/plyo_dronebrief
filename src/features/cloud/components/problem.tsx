import { Alert, AlertDescription } from '@/components/ui/alert'
export function Problem({ message }: { message: string | null }) { return message ? <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert> : null }
