import { useAuth } from '@/context/FirebaseAuthContext';
import ClientRegistrationDialog from '@/components/ClientRegistrationDialog';

interface ClientFormProps {
  onClose: () => void;
}

export default function FirebaseClientForm({ onClose }: ClientFormProps) {
  const { addClient } = useAuth();

  return <ClientRegistrationDialog onClose={onClose} onSave={addClient} />;
}
