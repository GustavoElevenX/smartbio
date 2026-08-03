export interface EmailProvider {
  send(input: { to: string; subject: string; html: string }): Promise<void>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(input: { to: string; subject: string; html: string }) {
    if (process.env.NODE_ENV !== "test") console.info("[email:development]", { to: input.to, subject: input.subject, htmlLength: input.html.length });
  }
}

export const emailTemplates = {
  welcome: (name: string) => ({ subject: "Sua SmartBio começa aqui", html: `<h1>Olá, ${name}</h1><p>Vamos criar seu melhor próximo passo.</p>` }),
  published: (project: string, url: string) => ({ subject: `${project} foi publicado`, html: `<p>Sua experiência está no ar em <a href="${url}">${url}</a>.</p>` }),
  newLead: (project: string, lead: string) => ({ subject: `Novo lead em ${project}`, html: `<p>${lead} concluiu uma jornada.</p>` }),
  invite: (workspace: string) => ({ subject: `Convite para ${workspace}`, html: `<p>Você recebeu um convite para colaborar.</p>` }),
  resetPassword: (url: string) => ({ subject: "Redefina sua senha", html: `<p><a href="${url}">Criar nova senha</a></p>` }),
};
