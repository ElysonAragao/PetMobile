"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Stethoscope, LogIn, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useSession } from "@/context/session-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Senha é obrigatória."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, changePassword, isAuthenticated } = useSession();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  
  const [showPasswordChange, setShowPasswordChange] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // Simple state for password change (no react-hook-form)
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changeError, setChangeError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isHandlingLogin, setIsHandlingLogin] = React.useState(false);

  // Redirecionamento automático se já estiver logado (mas não se estiver na tela de trocar senha)
  React.useEffect(() => {
    if (isAuthenticated && !showPasswordChange && !isHandlingLogin) {
      console.log("Usuário já autenticado detectado. Redirecionando para Menu...");
      router.replace('/');
    }
  }, [isAuthenticated, showPasswordChange, isHandlingLogin, router]);

  // Check if system is empty
  React.useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch('/api/setup');
        const data = await res.json();
        if (data.isEmpty) {
          console.log("Sistema zerado detectado. Redirecionando para /setup...");
          router.replace('/setup');
        }
      } catch (err) {
        console.error("Erro ao verificar setup:", err);
      }
    }
    checkSetup();
  }, [router]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    setIsHandlingLogin(true);
    console.log("Iniciando tentativa de login no servidor...");
    const result = await login(values.email, values.password);
    
    if (result.success) {
      console.log("Login realizado com sucesso!");
      if (result.requiresPasswordChange) {
        setShowPasswordChange(true);
      } else {
        // Redirecionamento manual forçado pois o AuthGuard é ignorado na rota de login
        console.log("Forçando redirecionamento para o Menu Inicial...");
        router.push('/');
      }
    } else {
      console.warn("Falha no login:", result.message);
      setError(result.message || "Ocorreu um erro desconhecido.");
      setIsHandlingLogin(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangeError(null);

    if (newPassword.length < 6) {
      setChangeError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeError("As senhas não conferem. Digite novamente.");
      return;
    }

    setIsSaving(true);
    const result = await changePassword(newPassword);
    setIsSaving(false);

    if (!result.success) {
      setChangeError(result.message || "Erro ao alterar a senha.");
    } else {
      console.log("Senha alterada com sucesso, redirecionando para o menu.");
      router.push('/');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-2xl font-bold font-headline text-primary-600 mb-8">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Stethoscope className="w-8 h-8 text-primary" />
        </div>
        <span className="text-3xl bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          PetMobile
        </span>
      </div>

      {!showPasswordChange ? (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>Acesse sua conta para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="usuario@email.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="******"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            <span className="sr-only">
                              {showPassword ? "Ocultar senha" : "Mostrar senha"}
                            </span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Erro no Login</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Entrando..." : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Defina sua Nova Senha</CardTitle>
            <CardDescription>
              Este é o seu primeiro acesso. Por segurança, defina uma nova senha pessoal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {changeError && (
                <Alert variant="destructive">
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{changeError}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? "Salvando..." : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Salvar Nova Senha
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
