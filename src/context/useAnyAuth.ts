import { useAuth } from './FirebaseAuthContext';

export default function useAnyAuth() {
  return useAuth();
}

