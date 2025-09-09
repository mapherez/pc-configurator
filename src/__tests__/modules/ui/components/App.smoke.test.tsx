import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { i18nSlice } from '../../../../modules/i18n/i18nSlice'
import { buildSlice } from '../../../../modules/build/buildSlice'
import { settingsSlice } from '../../../../modules/settings/settingsSlice'
import defaultSettings from '../../../../../settings/default.settings.json'
import type { Settings } from '../../../../modules/settings/types'
import defaultLocale from '../../../../../settings/default.locale.json'
import PartList from '../../../../modules/ui/components/PartList'
import BuildSummary from '../../../../modules/ui/components/BuildSummary'
import I18nProvider from '../../../../modules/i18n/I18nProvider'

// Create a test store
const store = configureStore({
  reducer: {
    i18n: i18nSlice.reducer,
    settings: settingsSlice.reducer,
    build: buildSlice.reducer,
  },
})

describe('UI smoke: PartList + BuildSummary', () => {
  beforeEach(() => {
    // ensure clean URL params between tests
    window.history.replaceState(null, '', '/')

    // Reset store to initial state
    const testSettings: Settings = {
      SETUP: {
        language: 'pt-PT',
        currency: 'EUR',
        languages: ['pt-PT', 'en-US'],
        gitHubPages: defaultSettings.SETUP?.gitHubPages,
      },
      // Use button mode so the test can click the select button by label
      PART_LIST: { type: 'button' },
      PART_SUMMARY: defaultSettings.PART_SUMMARY?.type === 'icon-button' || defaultSettings.PART_SUMMARY?.type === 'button'
        ? { type: defaultSettings.PART_SUMMARY.type }
        : { type: 'icon-button' },
    }

    store.dispatch(settingsSlice.actions.setSettings(testSettings))
    store.dispatch(i18nSlice.actions.setLocale(defaultLocale))
  })

  it('selects CPU and shows in summary; flags incompatible MOBO', async () => {
    const user = userEvent.setup()
    render(
      <Provider store={store}>
        <I18nProvider>
          <div>
            <PartList />
            <BuildSummary />
          </div>
        </I18nProvider>
      </Provider>
    )

    // Select a CPU within the CPU accordion (CPU is open by default)
    const cpuItem = screen.getByText('Ryzen 7 7800X3D').closest('li') as HTMLElement
    const selectBtn = within(cpuItem).getByRole('button', { name: /Selecionar/i })
    await user.click(selectBtn)
    // Button should now read Selecionado
    expect(within(cpuItem).getByRole('button', { name: /Selecionado/i })).toBeInTheDocument()

    // Summary should list the CPU name
    const summaryHeading = screen.getByRole('heading', { name: /Build Summary/i })
    const summarySection = summaryHeading.closest('section') as HTMLElement
    expect(within(summarySection).getByText(/Ryzen 7 7800X3D/i)).toBeInTheDocument()

    // Expand motherboard accordion
    const moboHeader = screen.getByRole('button', { name: /motherboard/i })
    await user.click(moboHeader)

    // Find an LGA1700 motherboard which should be incompatible with AM5 CPU
    const moboItem = screen.getByText('B760M Pro').closest('li') as HTMLElement
    expect(within(moboItem).getByTitle(/Incompat/i)).toBeInTheDocument()
  })
})
