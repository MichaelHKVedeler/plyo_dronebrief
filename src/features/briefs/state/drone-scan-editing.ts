import { createContext } from 'react'

// An editing preference, shared by the controls and both map providers.
export const DroneScanEditing = createContext({ locked: true, setLocked: (_locked: boolean) => {} })
