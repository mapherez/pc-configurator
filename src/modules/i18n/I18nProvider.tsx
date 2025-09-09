import { useEffect, type PropsWithChildren } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { setLocale } from './i18nSlice'
import { getLocale } from './i18n'

export default function I18nProvider({ children }: PropsWithChildren) {
  const dispatch = useAppDispatch()
  const language = useAppSelector((state) => state.settings.settings.SETUP.language)

  useEffect(() => {
    if (!language) return
    const newLocale = getLocale(language)
    dispatch(setLocale(newLocale))
  }, [dispatch, language])

  return <>{children}</>
}
