import { useTranslation } from 'react-i18next';
import { AccountScreen } from '@/components/AccountScreen';

export default function DonorAccount() {
  const { t } = useTranslation();
  return <AccountScreen title={t('account.title')} />;
}
