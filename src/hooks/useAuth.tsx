import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, fromEngine } from "@/lib/supabase";
import type { PersonRow } from "@/types/schema";

interface AuthState {
    user: User | null;
    session: Session | null;
    person: PersonRow | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signInWithOtp: (email: string) => Promise<{ error?: string }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [person, setPerson] = useState<PersonRow | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchPerson = useCallback(async (email: string) => {
        const { data, error } = await fromEngine("people_master")
            .select("*")
            .ilike("email", email)
            .eq("status", "Active")
            .maybeSingle();
        if (error) {
            console.error("people_master lookup failed", error);
            return null;
        }
        return (data as PersonRow) ?? null;
    }, []);

    useEffect(() => {
        let unsubscribe: { subscription: { unsubscribe: () => void } } | null = null;
        (async () => {
            const { data } = await supabase.auth.getSession();
            setSession(data.session);
            setUser(data.session?.user ?? null);
            if (data.session?.user?.email) {
                setPerson(await fetchPerson(data.session.user.email));
            }
            setLoading(false);

            unsubscribe = supabase.auth.onAuthStateChange(async (_event, newSession) => {
                setSession(newSession);
                setUser(newSession?.user ?? null);
                if (newSession?.user?.email) {
                    setPerson(await fetchPerson(newSession.user.email));
                } else {
                    setPerson(null);
                }
            }) as unknown as { subscription: { unsubscribe: () => void } };
        })();
        return () => {
            unsubscribe?.subscription.unsubscribe();
        };
    }, [fetchPerson]);

    const value = useMemo<AuthState>(
        () => ({
            user,
            session,
            person,
            loading,
            signIn: async (email, password) => {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                return error ? { error: error.message } : {};
            },
            signInWithOtp: async (email) => {
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: { emailRedirectTo: window.location.origin },
                });
                return error ? { error: error.message } : {};
            },
            signOut: async () => {
                await supabase.auth.signOut();
            },
        }),
        [user, session, person, loading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
