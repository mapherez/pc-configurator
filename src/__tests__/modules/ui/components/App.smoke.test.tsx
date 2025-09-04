import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { i18nSlice } from '../../../../modules/i18n/i18nSlice'
import { buildSlice } from '../../../../modules/build/buildSlice'
import defaultSettings from '../../../../../settings/default.settings.json'
import defaultLocale from '../../../../../settings/default.locale.json'
import PartList from '../../../../modules/ui/components/PartList'
import BuildSummary from '../../../../modules/ui/components/BuildSummary'

// Create a test store
const store = configureStore({
  reducer: {
    i18n: i18nSlice.reducer,
    build: buildSlice.reducer
  }
})

describe('UI smoke: PartList + BuildSummary', () => {
  beforeEach(() => {
    // ensure clean URL params between tests
    window.history.replaceState(null, '', '/')

    // Reset store to initial state
    store.dispatch(i18nSlice.actions.setSettings({ ...defaultSettings, language: 'en-US' }))
    store.dispatch(i18nSlice.actions.setLocale(defaultLocale))
  })

  it('selects CPU and shows in summary; flags incompatible MOBO', async () => {
    const user = userEvent.setup()
    render(
      <Provider store={store}>
        <div>
          <PartList />
          <BuildSummary />
        </div>
      </Provider>
    )

    // Select a CPU (default category is cpu)
    const cpuItem = screen.getByText('Ryzen 7 7800X3D').closest('li') as HTMLElement
    const selectBtn = within(cpuItem).getByRole('button', { name: /Selecionar/i })
    await user.click(selectBtn)
    // Button should now read Selecionado
    expect(within(cpuItem).getByRole('button', { name: /Selecionado/i })).toBeInTheDocument()

    // Summary should list the CPU name
    const summaryHeading = screen.getByRole('heading', { name: /Build Summary/i })
    const summarySection = summaryHeading.closest('section') as HTMLElement
    expect(within(summarySection).getByText(/Ryzen 7 7800X3D/i)).toBeInTheDocument()

    // Switch to motherboard category
    const categorySelect = screen.getByLabelText(/Categoria/i)
    await user.selectOptions(categorySelect, 'motherboard')

    // Find an LGA1700 motherboard which should be incompatible with AM5 CPU
    const moboItem = screen.getByText('B760M Pro').closest('li') as HTMLElement
    expect(within(moboItem).getByText(/Incompatível/)).toBeInTheDocument()
  })
})

