export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  switch (code) {
    case "invalid_credentials": return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
    case "email_not_confirmed": return "Confirme seu e-mail pelo link de cadastro antes de entrar.";
    case "user_already_exists":
    case "email_exists": return "Este e-mail já tem uma conta. Entre ou recupere sua senha.";
    case "weak_password": return "Escolha uma senha mais forte, com pelo menos 8 caracteres.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "Muitas tentativas. Aguarde um minuto e tente novamente.";
    case "provider_disabled":
    case "oauth_provider_not_supported": return "O login com Google está temporariamente indisponível. Use e-mail e senha.";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier": return "O link expirou ou foi aberto em outro navegador. Solicite um novo link e abra no navegador em que iniciou.";
    case "same_password": return "Escolha uma senha diferente da atual.";
    default: return "Não foi possível concluir. Verifique sua conexão e tente novamente.";
  }
}
