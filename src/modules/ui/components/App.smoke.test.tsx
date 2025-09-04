import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PartList from './PartList'
import BuildSummary from './BuildSummary'

describe('UI smoke: PartList + BuildSummary', () => {
  beforeEach(() => {
    // ensure clean URL params between tests
    window.history.replaceState(null, '', '/')
  })

  it('selects CPU and shows in summary; flags incompatible MOBO', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <PartList />
        <BuildSummary />
      </div>
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

