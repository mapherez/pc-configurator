export type PartListInputType = 'button' | 'radio' | 'checkbox'
export type PartSummaryInputType = 'button' | 'icon-button'

export interface PartListSettings {
  type: PartListInputType
}

export interface PartSummarySettings {
  type: PartSummaryInputType
}
