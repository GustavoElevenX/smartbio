import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como a SOBE coleta, usa e protege dados pessoais.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      description="Esta política resume como a SOBE trata dados pessoais de usuários da plataforma e de visitantes das páginas publicadas."
      updatedAt="31 de agosto de 2026"
    >
      <section>
        <h2>Dados que coletamos</h2>
        <p className="mt-4">
          Tratamos dados de conta e do negócio, como nome, e-mail, perfil,
          workspace, ofertas, canais e configurações. Também tratamos dados de
          uso e, quando um visitante preenche uma jornada, os dados de lead
          enviados por ele, como nome, contato, respostas e contexto da origem.
        </p>
      </section>

      <section>
        <h2>Como usamos os dados</h2>
        <p className="mt-4">
          Usamos essas informações para autenticar usuários, criar e publicar
          páginas, operar jornadas, gerar leads e oportunidades, oferecer
          agendamentos, processar cobranças, medir o uso, prevenir abusos e
          prestar suporte. Também usamos dados para cumprir obrigações legais e
          proteger a segurança da plataforma.
        </p>
      </section>

      <section>
        <h2>Processamento por inteligência artificial</h2>
        <p className="mt-4">
          Durante a ativação e em recursos assistidos, informações fornecidas
          pelo usuário e fontes do negócio podem ser processadas por modelos da
          OpenAI para interpretar o contexto, sugerir jornadas e produzir
          conteúdo. A IA auxilia a criação; o usuário deve revisar e confirmar
          o que será utilizado ou publicado.
        </p>
      </section>

      <section>
        <h2>Compartilhamento com fornecedores</h2>
        <p className="mt-4">
          Compartilhamos somente o necessário com fornecedores que apoiam a
          operação, incluindo Supabase para dados e autenticação, Stripe para
          pagamentos, OpenAI para recursos de IA e provedores de infraestrutura,
          hospedagem, comunicação e monitoramento. Também podemos compartilhar
          dados quando houver obrigação legal.
        </p>
      </section>

      <section>
        <h2>Leads de visitantes</h2>
        <p className="mt-4">
          O negócio que publica uma página define quais dados solicita e para
          qual finalidade comercial. A SOBE processa esses dados para entregar a
          jornada e a oportunidade ao negócio. Visitantes também podem exercer
          seus direitos diretamente com esse negócio quando ele for o responsável
          pela decisão sobre o tratamento.
        </p>
      </section>

      <section>
        <h2>Retenção e segurança</h2>
        <p className="mt-4">
          Mantemos os dados enquanto a conta estiver ativa ou pelo período
          necessário para prestar o serviço, cumprir obrigações legais, resolver
          disputas e prevenir fraudes. Depois disso, os dados podem ser excluídos
          ou anonimizados. Aplicamos medidas técnicas e organizacionais para
          reduzir riscos de acesso, alteração ou divulgação indevida.
        </p>
      </section>

      <section>
        <h2>Seus direitos pela LGPD</h2>
        <p className="mt-4">
          Você pode solicitar confirmação e acesso ao tratamento, correção,
          portabilidade quando aplicável, informação sobre compartilhamentos,
          anonimização ou exclusão de dados desnecessários, além de revogar
          consentimento ou se opor ao tratamento nas hipóteses legais.
        </p>
      </section>

      <section>
        <h2>Exclusão, portabilidade e contato</h2>
        <p className="mt-4">
          Para solicitar exclusão, acesso ou portabilidade, envie um e-mail para
          o endereço de suporte informado no painel e nos canais oficiais da
          SOBE. Podemos pedir informações para confirmar sua identidade e
          responderemos conforme os prazos e limites previstos na legislação.
        </p>
      </section>
    </LegalPage>
  );
}
